// Copyright (c) Microsoft. All rights reserved.

import "rxjs";
import { of } from "rxjs";
import moment from "moment";
import { schema, normalize } from "normalizr";
import update from "immutability-helper";
import { createSelector } from "reselect";
import { ofType } from "redux-observable";
import {
    map,
    distinctUntilChanged,
    mergeMap,
    catchError,
} from "rxjs/operators";
import {
    redux as appRedux,
    getActiveDeviceGroupConditions,
    getActiveDeviceQueryConditions,
    getActiveDeviceGroupMapping,
    getDefaultColumnMapping,
} from "./appReducer";
import { IoTHubManagerService } from "services";
import {
    createReducerScenario,
    createEpicScenario,
    resetPendingAndErrorReducer,
    errorPendingInitialState,
    pendingReducer,
    errorReducer,
    setPending,
    toActionCreator,
    getPending,
    getError,
} from "store/utilities";

// ========================= Epics - START
const handleError = (fromAction) => (error) =>
    of(redux.actions.registerError(fromAction.type, { error, fromAction }));

let cToken = null;

export const epics = createEpicScenario({
    /** Loads the devices */
    fetchDevices: {
        type: "DEVICES_FETCH",
        epic: (fromAction, store) => {
            const activeDeviceGroupMappings = getActiveDeviceGroupMapping(
                store.value
            );
            const defaultColumnMappings = getDefaultColumnMapping(store.value);
            const columnMappings = [
                ...((activeDeviceGroupMappings || {}).mapping || []),
                ...((defaultColumnMappings || {}).mapping || []),
            ];
            const rawConditions = getActiveDeviceGroupConditions(
                    store.value
                ).concat(getActiveDeviceQueryConditions(store.value)),
                conditions = rawConditions.filter((condition) => {
                    return (
                        !!condition.key &&
                        !!condition.operator &&
                        !!condition.value
                    );
                });

            return IoTHubManagerService.getDevices(
                conditions,
                columnMappings
            ).pipe(
                map((response) => {
                    cToken = response.continuationToken;
                    return response;
                }),
                map(toActionCreator(redux.actions.updateDevices, fromAction)),
                mergeMap((action) => {
                    const actions = [];
                    actions.push(action);
                    if (cToken && store.value.devices.makeCTokenDeviceCalls) {
                        actions.push(epics.actions.fetchDevicesByCToken());
                    }
                    return actions;
                }),
                catchError(handleError(fromAction))
            );
        },
    },

    /** Loads the devices by Continuation Token */
    fetchDevicesByCToken: {
        type: "DEVICES_FETCH_CTOKEN",
        epic: (fromAction, store) => {
            if (cToken) {
                const activeDeviceGroupMappings = getActiveDeviceGroupMapping(
                    store.value
                );
                const defaultColumnMappings = getDefaultColumnMapping(
                    store.value
                );
                const columnMappings = [
                    ...((activeDeviceGroupMappings || {}).mapping || []),
                    ...((defaultColumnMappings || {}).mapping || []),
                ];
                const rawConditions = getActiveDeviceGroupConditions(
                        store.value
                    ).concat(getActiveDeviceQueryConditions(store.value)),
                    conditions = rawConditions.filter((condition) => {
                        return (
                            !!condition.key &&
                            !!condition.operator &&
                            !!condition.value
                        );
                    });
                return IoTHubManagerService.getDevices(
                    conditions,
                    columnMappings,
                    cToken
                ).pipe(
                    map((response) => {
                        cToken = response.continuationToken;
                        return response;
                    }),
                    map(
                        toActionCreator(redux.actions.insertDevices, fromAction)
                    ),
                    mergeMap((action) => {
                        const actions = [];
                        actions.push(action);
                        if (
                            cToken &&
                            store.value.devices.makeCTokenDeviceCalls
                        ) {
                            actions.push(epics.actions.fetchDevicesByCToken());
                        }
                        return actions;
                    }),
                    catchError(handleError(fromAction))
                );
            }
            return [];
        },
    },

    /** Loads the devices by condition provided in payload*/
    fetchDevicesByCondition: {
        type: "DEVICES_FETCH_BY_CONDITION",
        epic: (fromAction) => {
            return IoTHubManagerService.getDevices(
                fromAction.payload.data
            ).pipe(
                map((response) => {
                    return response;
                }),
                map(
                    toActionCreator(
                        fromAction.payload.insertIntoGrid
                            ? redux.actions.insertDevices
                            : redux.actions.updateDevicesByCondition,
                        fromAction
                    )
                ),
                catchError(handleError(fromAction))
            );
        },
    },

    /** Loads EdgeAgent json from device modules */
    fetchEdgeAgent: {
        type: "DEVICES_FETCH_EDGE_AGENT",
        epic: (fromAction) =>
            IoTHubManagerService.getModulesByQuery(
                `"deviceId IN ['${fromAction.payload}'] AND moduleId = '$edgeAgent'"`
            ).pipe(
                map(([edgeAgent]) => edgeAgent),
                map(
                    toActionCreator(
                        redux.actions.updateModuleStatus,
                        fromAction
                    )
                ),
                catchError(handleError(fromAction))
            ),
    },

    /* Update the devices if the selected device group changes */
    refreshDevices: {
        type: "DEVICES_REFRESH",
        rawEpic: ($actions) =>
            $actions.pipe(
                ofType(appRedux.actionTypes.updateActiveDeviceGroup),
                map(({ payload }) => payload),
                distinctUntilChanged(),
                mergeMap((_) => [
                    epics.actions.fetchDevices(),
                    epics.actions.fetchDeviceStatistics(),
                ])
            ),
    },

    /** Loads the device statistics */
    fetchDeviceStatistics: {
        type: "DEVICE_STATISTICS_FETCH",
        epic: (fromAction, store) => {
            const rawConditions = getActiveDeviceGroupConditions(
                    store.value
                ).concat(getActiveDeviceQueryConditions(store.value)),
                conditions = rawConditions.filter((condition) => {
                    return (
                        !!condition.key &&
                        !!condition.operator &&
                        !!condition.value
                    );
                });
            return IoTHubManagerService.getDeviceStatistics(conditions).pipe(
                map(
                    toActionCreator(
                        redux.actions.updateDeviceStatistics,
                        fromAction
                    )
                ),
                catchError(handleError(fromAction))
            );
        },
    },
});
// ========================= Epics - END

// ========================= Schemas - START
const deviceSchema = new schema.Entity("devices"),
    deviceListSchema = new schema.Array(deviceSchema),
    deviceWithMappingSchema = new schema.Entity("devicesWithMapping"),
    deviceWithMappingListSchema = new schema.Array(deviceWithMappingSchema),
    // ========================= Schemas - END

    // ========================= Reducers - START
    initialState = {
        ...errorPendingInitialState,
        entities: {},
        entitiesWithMappings: {},
        items: [],
        lastUpdated: "",
        totalDeviceCount: 0,
        connectedDeviceCount: 0,
        makeCTokenDeviceCalls: false,
        devicesByConditionEntities: {},
        devicesByConditionItems: [],
    },
    updateDevicesReducer = (state, { payload, fromAction }) => {
        const {
            entities: { devices },
            result,
        } = normalize(payload.items, deviceListSchema);
        const {
            entities: { devicesWithMapping },
        } = normalize(payload.itemsWithMapping, deviceWithMappingListSchema);
        return update(state, {
            entities: { $set: devices },
            entitiesWithMappings: { $set: devicesWithMapping },
            items: { $set: result },
            lastUpdated: { $set: moment() },
            ...setPending(fromAction.type, false),
        });
    },
    updateDeviceStatisticsReducer = (state, { payload, fromAction }) => {
        return update(state, {
            totalDeviceCount: { $set: payload.totalDeviceCount },
            connectedDeviceCount: { $set: payload.connectedDeviceCount },
            ...setPending(fromAction.type, false),
        });
    },
    updateDevicesByConditionReducer = (state, { payload, fromAction }) => {
        const {
            entities: { devices },
            result,
        } = normalize(payload.items, deviceListSchema);
        return update(state, {
            devicesByConditionEntities: { $set: devices },
            devicesByConditionItems: { $set: result },
            ...setPending(fromAction.type, false),
        });
    },
    resetDeviceByConditionReducer = (state) => {
        return update(state, {
            devicesByConditionEntities: { $set: {} },
            devicesByConditionItems: { $set: [] },
        });
    },
    deleteDevicesReducer = (state, { payload }) => {
        const spliceArr = payload.reduce((idxAcc, payloadItem) => {
            const idx = state.items.indexOf(payloadItem);
            if (idx !== -1) {
                idxAcc.push([idx, 1]);
            }
            return idxAcc;
        }, []);
        const spliceDevicesByConditionItems = payload.reduce(
            (idxAcc, payloadItem) => {
                const idx = state.devicesByConditionItems.indexOf(payloadItem);
                if (idx !== -1) {
                    idxAcc.push([idx, 1]);
                }
                return idxAcc;
            },
            []
        );
        return update(state, {
            entities: { $unset: payload },
            items: { $splice: spliceArr },
            devicesByConditionEntities: { $unset: payload },
            devicesByConditionItems: { $splice: spliceDevicesByConditionItems },
        });
    },
    insertDevicesReducer = (state, { payload }) => {
        // // As some of the multiple contains clauses lead to duplicates, we are explicitly removing the duplicates
        if (payload.items && payload.items.length > 0) {
            payload.items = payload.items.filter(
                (v, i, a) => a.findIndex((t) => t.id === v.id) === i
            );
            // Excluding the devices that are already loaded(on-demand) into the grid
            payload.items = payload.items.filter((device) => {
                return !state.items.includes(device.id);
            });
        }

        // // As some of the multiple contains clauses lead to duplicates, we are explicitly removing the duplicates
        if (payload.itemsWithMapping && payload.itemsWithMapping.length > 0) {
            payload.itemsWithMapping = payload.itemsWithMapping.filter(
                (v, i, a) => a.findIndex((t) => t.id === v.id) === i
            );
            // Excluding the devices that are already loaded(on-demand) into the grid
            payload.itemsWithMapping = payload.itemsWithMapping.filter(
                (device) => {
                    return !state.items.includes(device.id);
                }
            );
        }

        const inserted = payload.items.map((device) => ({
                ...device,
                isNew: true,
            })),
            insertedWithMapping = payload.itemsWithMapping.map((device) => ({
                ...device,
                isNew: true,
            })),
            {
                entities: { devices },
                result,
            } = normalize(inserted, deviceListSchema),
            {
                entities: { devicesWithMapping },
            } = normalize(insertedWithMapping, deviceWithMappingListSchema);
        if (state.entities) {
            return update(state, {
                entities: { $merge: devices },
                entitiesWithMappings: { $merge: devicesWithMapping },
                items: { $splice: [[0, 0, ...result]] },
            });
        }
        return update(state, {
            entities: { $set: devices },
            entitiesWithMappings: { $set: devicesWithMapping },
            items: { $set: result },
        });
    },
    updateTagsReducer = (state, { payload }) => {
        const updatedTagData = {};
        payload.updatedTags.forEach(
            ({ name, value }) => (updatedTagData[name] = value)
        );

        const updatedDevices = payload.deviceIds.map((id) =>
                update(state.entities[id], {
                    tags: {
                        $merge: updatedTagData,
                        $unset: payload.deletedTags,
                    },
                })
            ),
            {
                entities: { devices },
            } = normalize(updatedDevices, deviceListSchema);
        return update(state, {
            entities: { $merge: devices },
        });
    },
    updateModuleStatusReducer = (state, { payload, fromAction }) => {
        const updateAction = payload
            ? { deviceModuleStatus: { $set: payload } }
            : { $unset: ["deviceModuleStatus"] };

        return update(state, {
            ...updateAction,
            ...setPending(fromAction.type, false),
        });
    },
    updatePropertiesReducer = (state, { payload }) => {
        const updatedPropertyData = {};
        payload.updatedProperties.forEach(
            ({ name, value }) => (updatedPropertyData[name] = value)
        );

        const updatedDevices = payload.deviceIds.map((id) =>
                update(state.entities[id], {
                    desiredProperties: {
                        $merge: updatedPropertyData,
                        $unset: payload.deletedProperties,
                    },
                })
            ),
            {
                entities: { devices },
            } = normalize(updatedDevices, deviceListSchema);
        return update(state, {
            entities: { $merge: devices },
        });
    },
    cancelDeviceCallsReducer = (state, { payload }) => {
        return update(state, {
            makeCTokenDeviceCalls: { $set: payload.makeSubsequentCalls },
        });
    },
    /* Action types that cause a pending flag */
    fetchableTypes = [
        epics.actionTypes.fetchDevices,
        epics.actionTypes.fetchDevicesByCondition,
        epics.actionTypes.fetchEdgeAgent,
        epics.actionTypes.fetchDeviceStatistics,
    ];

export const redux = createReducerScenario({
    updateDevices: { type: "DEVICES_UPDATE", reducer: updateDevicesReducer },
    updateDeviceStatistics: {
        type: "DEVICE_STATISTICS_UPDATE",
        reducer: updateDeviceStatisticsReducer,
    },
    updateDevicesByCondition: {
        type: "DEVICES_UPDATE_BY_CONDITION",
        reducer: updateDevicesByConditionReducer,
    },
    resetDeviceByCondition: {
        type: "DEVICES_RESET_BY_CONDITION",
        reducer: resetDeviceByConditionReducer,
    },
    registerError: { type: "DEVICES_REDUCER_ERROR", reducer: errorReducer },
    isFetching: { multiType: fetchableTypes, reducer: pendingReducer },
    deleteDevices: { type: "DEVICE_DELETE", reducer: deleteDevicesReducer },
    insertDevices: { type: "DEVICE_INSERT", reducer: insertDevicesReducer },
    updateTags: { type: "DEVICE_UPDATE_TAGS", reducer: updateTagsReducer },
    updateProperties: {
        type: "DEVICE_UPDATE_PROPERTIES",
        reducer: updatePropertiesReducer,
    },
    updateModuleStatus: {
        type: "DEVICE_MODULE_STATUS",
        reducer: updateModuleStatusReducer,
    },
    resetPendingAndError: {
        type: "DEVICE_REDUCER_RESET_ERROR_PENDING",
        reducer: resetPendingAndErrorReducer,
    },
    cancelDeviceCalls: {
        type: "CANCEL_DEVICE_CALLS",
        reducer: cancelDeviceCallsReducer,
    },
});

export const reducer = { devices: redux.getReducer(initialState) };
// ========================= Reducers - END

// ========================= Selectors - START
export const getDevicesReducer = (state) => state.devices;
export const getEntities = (state) => getDevicesReducer(state).entities || {};
export const getEntitiesWithMappings = (state) =>
    getDevicesReducer(state).entitiesWithMappings || {};
export const getItems = (state) => getDevicesReducer(state).items || [];
export const getDevicesLastUpdated = (state) =>
    getDevicesReducer(state).lastUpdated;
export const getDevicesError = (state) =>
    getError(getDevicesReducer(state), epics.actionTypes.fetchDevices);
export const getDevicesPendingStatus = (state) =>
    getPending(getDevicesReducer(state), epics.actionTypes.fetchDevices);
export const getDevicesByConditionEntities = (state) =>
    getDevicesReducer(state).devicesByConditionEntities || {};
export const getDevicesByConditionItems = (state) =>
    getDevicesReducer(state).devicesByConditionItems || [];
export const getDevicesByCondition = createSelector(
    getDevicesByConditionEntities,
    getDevicesByConditionItems,
    (entities, items) => items.map((id) => entities[id])
);
export const getDevicesByConditionError = (state) =>
    getError(
        getDevicesReducer(state),
        epics.actionTypes.fetchDevicesByCondition
    );
export const getDevicesByConditionPendingStatus = (state) =>
    getPending(
        getDevicesReducer(state),
        epics.actionTypes.fetchDevicesByCondition
    );
export const getDevices = createSelector(
    getEntities,
    getItems,
    (entities, items) => items.map((id) => entities[id])
);
export const getDevicesWithMappings = createSelector(
    getEntitiesWithMappings,
    getItems,
    (entitiesWithMappings, items) => items.map((id) => entitiesWithMappings[id])
);
export const getDeviceById = (state, id) => getEntities(state)[id];
export const getDeviceByConditionById = (state, id) =>
    getDevicesByConditionEntities(state)[id];
export const getDeviceModuleStatus = (state) => {
    const deviceModuleStatus = getDevicesReducer(state).deviceModuleStatus;
    return deviceModuleStatus
        ? {
              code: deviceModuleStatus.code,
              description: deviceModuleStatus.description,
          }
        : undefined;
};
export const getDeviceModuleStatusPendingStatus = (state) =>
    getPending(getDevicesReducer(state), epics.actionTypes.fetchEdgeAgent);
export const getDeviceModuleStatusError = (state) =>
    getError(getDevicesReducer(state), epics.actionTypes.fetchEdgeAgent);
export const getDeviceStatistics = (state) => {
    const deviceState = getDevicesReducer(state);
    return deviceState
        ? {
              totalDeviceCount: deviceState.totalDeviceCount,
              connectedDeviceCount: deviceState.connectedDeviceCount,
              loadedDeviceCount: deviceState.items.length,
          }
        : undefined;
};
export const getDeviceStatisticsPendingStatus = (state) =>
    getPending(
        getDevicesReducer(state),
        epics.actionTypes.fetchDeviceStatistics
    );
export const getDeviceStatisticsError = (state) =>
    getError(getDevicesReducer(state), epics.actionTypes.fetchDeviceStatistics);
export const getLoadMoreToggleState = (state) => {
    const deviceState = getDevicesReducer(state);
    return deviceState.makeCTokenDeviceCalls;
};
// ========================= Selectors - END
