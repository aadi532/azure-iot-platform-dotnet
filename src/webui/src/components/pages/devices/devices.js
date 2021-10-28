// Copyright (c) Microsoft. All rights reserved.

import React, { Component } from "react";

import { permissions, toDiagnosticsModel } from "services/models";
import { DevicesGridContainer } from "./devicesGrid";
import { DeviceGroupDropdownContainer as DeviceGroupDropdown } from "components/shell/deviceGroupDropdown";
import { ManageDeviceGroupsBtnContainer as ManageDeviceGroupsBtn } from "components/shell/manageDeviceGroupsBtn";
import { ResetActiveDeviceQueryBtnContainer as ResetActiveDeviceQueryBtn } from "components/shell/resetActiveDeviceQueryBtn";
import {
    AjaxError,
    Btn,
    ComponentArray,
    ContextMenuAgile,
    PageContent,
    PageTitle,
    Protected,
    RefreshBarContainer as RefreshBar,
    JsonEditorModal,
} from "components/shared";
import { DeviceNewContainer } from "./flyouts/deviceNew";
import { AdvanceSearchContainer } from "./advanceSearch";
import { SIMManagementContainer } from "./flyouts/SIMManagement";
import { CreateDeviceQueryBtnContainer as CreateDeviceQueryBtn } from "components/shell/createDeviceQueryBtn";
import { svgs, getDeviceGroupParam, getTenantIdParam } from "utilities";
import {
    IdentityGatewayService,
    IoTHubManagerService,
    ConfigService,
} from "services";
import { ColumnDialog } from "./columnDialog";
import { ActionButton } from "@fluentui/react/lib/Button";
import { Toggle } from "@fluentui/react/lib/Toggle";
import {
    generateColumnOptionsFromMappings,
    generateColumnDefsFromSelectedOptions,
    generateSelectedOptionsFromMappings,
    generateColumnDefsFromMappings,
    generateMappingObjectForDownload,
} from "./devicesGrid/deviceColumnHelper";

const classnames = require("classnames/bind");
const css = classnames.bind(require("./devices.module.scss"));

const closedFlyoutState = { openFlyoutName: undefined };

const closedModalState = {
    openModalName: undefined,
};

export class Devices extends Component {
    constructor(props) {
        super(props);
        this.state = {
            ...closedFlyoutState,
            showColumnDialog: false,
            contextBtns: null,
            selectedDeviceGroupId: undefined,
            loadMore: this.props.loadMoreState,
            isDeviceSearch: false,
            columnOptions: [],
            selectedOptions: [],
            columnDefinitions: [],
            defaultColumnMappings: [],
            isColumnMappingsPending: this.props.isColumnMappingsPending,
        };

        this.props.updateCurrentWindow("Devices");

        if (
            !this.props.isColumnMappingsPending &&
            this.props.activeDeviceGroupId
        ) {
            var defaultColumnMappings = props.columnMappings["Default"]
                ? props.columnMappings["Default"].mapping
                : [];
            this.ColumnOptions = [];

            this.state = {
                ...this.state,
                defaultColumnMappings: defaultColumnMappings,
                ...this.setMappingsAndOptions(
                    props,
                    this.props.activeDeviceGroupId
                ),
            };

            this.state = {
                ...this.state,
                ...this.setColumnOptions(this.state),
            };
        }
    }

    setMappingsAndOptions(props, deviceGroupId = null) {
        const defaultMappings = props.columnMappings["Default"]?.mapping ?? [];
        const deviceGroupMappingId =
            props.deviceGroups.find(
                (dg) => dg.id === (deviceGroupId ?? props.activeDeviceGroupId)
            ).mappingId ?? null;

        this.DeviceGroupColumnMappings = props.columnMappings[
            deviceGroupMappingId
        ]
            ? defaultMappings.concat(
                  props.columnMappings[deviceGroupMappingId].mapping
              )
            : [];

        const colOption = props.columnOptions.find(
            (c) =>
                c.deviceGroupId === (deviceGroupId ?? props.activeDeviceGroupId)
        );
        this.ColumnOptionsModel = colOption ?? null;
        return {
            selectedOptions: colOption ? colOption.selectedOptions : [],
        };
    }

    setColumnOptions(state) {
        if (
            this.DeviceGroupColumnMappings.length === 0 &&
            state.selectedOptions.length === 0 &&
            state.defaultColumnMappings.length > 0
        ) {
            return {
                columnOptions: generateColumnOptionsFromMappings(
                    state.defaultColumnMappings
                ),
                selectedOptions: generateSelectedOptionsFromMappings(
                    state.defaultColumnMappings
                ),
                columnDefinitions: generateColumnDefsFromMappings(
                    state.defaultColumnMappings
                ),
            };
        } else if (
            this.DeviceGroupColumnMappings.length === 0 &&
            state.selectedOptions.length > 0 &&
            state.defaultColumnMappings.length > 0
        ) {
            return {
                columnOptions: generateColumnOptionsFromMappings(
                    state.defaultColumnMappings
                ),
                columnDefinitions: generateColumnDefsFromSelectedOptions(
                    state.defaultColumnMappings,
                    state.selectedOptions
                ),
            };
        } else if (
            this.DeviceGroupColumnMappings.length > 0 &&
            state.selectedOptions.length === 0
        ) {
            return {
                columnOptions: generateColumnOptionsFromMappings(
                    this.DeviceGroupColumnMappings
                ),
                selectedOptions: generateSelectedOptionsFromMappings(
                    state.defaultColumnMappings
                ),
                columnDefinitions: generateColumnDefsFromMappings(
                    state.defaultColumnMappings
                ),
            };
        } else if (
            this.DeviceGroupColumnMappings.length > 0 &&
            state.selectedOptions.length > 0
        ) {
            return {
                columnOptions: generateColumnOptionsFromMappings(
                    this.DeviceGroupColumnMappings
                ),
                columnDefinitions: generateColumnDefsFromSelectedOptions(
                    this.DeviceGroupColumnMappings,
                    state.selectedOptions
                ),
            };
        }
    }

    UNSAFE_componentWillMount() {
        if (this.props.location && this.props.location.search) {
            const tenantId = getTenantIdParam(this.props.location);
            this.props.checkTenantAndSwitch({
                tenantId: tenantId,
                redirectUrl: window.location.href,
            });
            this.setState({
                selectedDeviceGroupId: getDeviceGroupParam(this.props.location),
            });
        }

        if (
            this.props &&
            this.props.location &&
            this.props.location.pathname === "/deviceSearch"
        ) {
            this.props.resetDeviceByCondition();
            this.setState({
                isDeviceSearch: true,
            });
        } else {
            this.setState({
                isDeviceSearch: false,
            });
        }

        IdentityGatewayService.VerifyAndRefreshCache();
    }

    UNSAFE_componentWillReceiveProps(nextProps) {
        if (
            nextProps.isPending &&
            nextProps.isPending !== this.props.isPending
        ) {
            // If the grid data refreshes, hide most flyouts and deselect soft selections
            switch (this.state.openFlyoutName) {
                case "create-device-query":
                    // leave this flyout open even on grid refresh
                    break;
                default:
                    this.setState(closedFlyoutState);
            }
        }

        if (
            !nextProps.isColumnMappingsPending &&
            this.props.activeDeviceGroupId
        ) {
            var defaultColumnMappings = nextProps.columnMappings["Default"]
                ? nextProps.columnMappings["Default"].mapping
                : [];

            let tempState = {
                ...this.state,
                defaultColumnMappings: defaultColumnMappings,
                ...this.setMappingsAndOptions(
                    nextProps,
                    this.props.activeDeviceGroupId
                ),
            };
            this.setState({
                ...tempState,
                ...this.setColumnOptions(tempState),
                isColumnMappingsPending: nextProps.isColumnMappingsPending,
            });
        } else {
            this.setState({
                isColumnMappingsPending: nextProps.isColumnMappingsPending,
            });
        }
    }

    componentDidMount() {
        if (this.state.selectedDeviceGroupId && this.props.location) {
            window.history.replaceState(
                {},
                document.title,
                this.props.location.pathname
            );
        }
    }

    closeFlyout = () => this.setState(closedFlyoutState);

    openSIMManagement = () =>
        this.setState({ openFlyoutName: "sim-management" });
    openNewDeviceFlyout = () => {
        this.setState({ openFlyoutName: "new-device" });
        this.props.logEvent(toDiagnosticsModel("Devices_NewClick", {}));
    };
    openCloudToDeviceFlyout = () => {
        this.setState({ openFlyoutName: "c2d-message" });
        this.props.logEvent(toDiagnosticsModel("Devices_C2DClick", {}));
    };

    onContextMenuChange = (contextBtns) =>
        this.setState({
            contextBtns,
            openFlyoutName: undefined,
        });

    openModal = (modalName, jsonValue) => {
        this.setState({
            openModalName: modalName,
            modalJson: jsonValue,
        });
    };

    closeModal = () => this.setState(closedModalState);

    openColumnOptions = () => {
        this.setState({ showColumnDialog: true });
    };

    getOpenModal = () => {
        const { t, theme, logEvent } = this.props;
        if (this.state.openModalName === "json-editor") {
            return (
                <JsonEditorModal
                    t={t}
                    title={t(
                        "devices.flyouts.details.properties.editPropertyValue"
                    )}
                    onClose={this.closeModal}
                    jsonData={this.state.modalJson}
                    logEvent={logEvent}
                    theme={theme ? theme : "light"}
                />
            );
        }
        return null;
    };

    priorityChildren = () => {
        const { t } = this.props;
        const { isDeviceSearch } = this.state;

        let children = [];

        if (!isDeviceSearch) {
            children.push(
                <DeviceGroupDropdown
                    updateLoadMore={this.updateLoadMoreOnDeviceGroupChange}
                    deviceGroupIdFromUrl={this.state.selectedDeviceGroupId}
                    updateColumns={this.updateColumnsOnDeviceGroupChange}
                />,
                <Protected permission={permissions.updateDeviceGroups}>
                    <ManageDeviceGroupsBtn />
                </Protected>,
                <CreateDeviceQueryBtn />
            );
        }

        if (
            !isDeviceSearch &&
            this.props.activeDeviceQueryConditions.length !== 0
        ) {
            children.push(<ResetActiveDeviceQueryBtn />);
        }

        if (
            this.state.contextBtns &&
            this.state.contextBtns.props.children.length > 0
        ) {
            children = children.concat(this.state.contextBtns.props.children);
        }

        children.push(
            <Protected permission={permissions.updateSIMManagement}>
                <Btn svg={svgs.simmanagement} onClick={this.openSIMManagement}>
                    {t("devices.flyouts.SIMManagement.title")}
                </Btn>
            </Protected>
        );

        return children;
    };

    switchLoadMore = (event, checked) => {
        this.setState({ loadMore: checked }, () =>
            this.props.cancelDeviceCalls({
                makeSubsequentCalls: checked,
            })
        );

        if (checked) {
            this.props.fetchDevicesByCToken();
        }
    };

    refreshDevices = () => {
        this.setState({ loadMore: false });
        this.props.cancelDeviceCalls({ makeSubsequentCalls: false });
        return this.props.fetchDevices();
    };

    updateLoadMoreOnDeviceGroupChange = () => {
        this.setState({ loadMore: false });
        this.props.cancelDeviceCalls({ makeSubsequentCalls: false });
    };

    updateColumnsOnDeviceGroupChange = (deviceGroupId) => {
        let tempState = {
            ...this.state,
            ...this.setMappingsAndOptions(this.props, deviceGroupId),
        };

        this.setState({
            ...this.setColumnOptions(tempState),
        });
    };

    toggleColumnDialog = () => {
        const { showColumnDialog } = this.state;
        this.setState({ showColumnDialog: !showColumnDialog });
    };

    downloadFile = () => {
        let mappingObject = [];
        if (!this.isDeviceSearch) {
            mappingObject = generateMappingObjectForDownload(
                this.DeviceGroupColumnMappings.length === 0
                    ? this.state.defaultColumnMappings
                    : this.DeviceGroupColumnMappings,
                this.state.selectedOptions
            );
        }
        IoTHubManagerService.getDevicesReportByQuery(
            this.props.activeDeviceGroupConditions,
            mappingObject
        ).subscribe((response) => {
            var blob = new Blob([response.response], {
                type: response.response.type,
            });
            let url = window.URL.createObjectURL(blob);
            let a = document.createElement("a");
            a.href = url;
            a.download = "DevicesList.xlsx";
            a.click();
        });
    };

    updateColumns = (saveUpdates, selectedColumnOptions) => {
        var tempState = {
            ...this.state,
            showColumnDialog: !this.state.showColumnDialog,
            selectedOptions: selectedColumnOptions,
        };

        this.setState({
            ...tempState,
            ...this.setColumnOptions(tempState),
        });

        if (saveUpdates) {
            var requestData = {
                DeviceGroupId: this.props.activeDeviceGroupId,
                SelectedOptions: selectedColumnOptions,
            };
            if (!this.ColumnOptionsModel) {
                ConfigService.saveColumnOptions(requestData).subscribe(
                    (columnMapping) => {
                        this.ColumnOptionsModel = columnMapping;
                        this.props.insertColumnOptions([columnMapping]);
                    },
                    (error) => {}
                );
            } else {
                this.ColumnOptionsModel.selectedOptions = selectedColumnOptions;
                ConfigService.updateColumnOptions(
                    this.ColumnOptionsModel.id,
                    this.ColumnOptionsModel
                ).subscribe(
                    (columnMapping) => {
                        this.ColumnOptionsModel = columnMapping;
                    },
                    (error) => {}
                );
            }
        }
    };

    getGridControls = () => {
        const { t } = this.props;
        const { isDeviceSearch } = this.state;

        if (isDeviceSearch) {
            return null;
        }

        return (
            <>
                <Toggle
                    label={t("devices.loadMore")}
                    inlineLabel
                    onText="On"
                    offText="Off"
                    checked={this.state.loadMore}
                    onChange={this.switchLoadMore}
                    className={css("grid-control")}
                />
                <ActionButton
                    iconProps={{ iconName: "Download" }}
                    onClick={this.downloadFile}
                    text={t("devices.downloadDeviceReport")}
                    className={css("grid-control")}
                />
                <ActionButton
                    iconProps={{ iconName: "ColumnOptions" }}
                    onClick={this.openColumnOptions}
                    text={t("devices.columnOptions")}
                    className={css("grid-control")}
                />
            </>
        );
    };

    /**
     * Get the grid api options
     *
     * @param {Object} gridReadyEvent An object containing access to the grid APIs
     */
    onGridReady = (gridReadyEvent) => {
        this.deviceGridApi = gridReadyEvent.api;
    };

    render() {
        const {
                t,
                devices,
                deviceGroupError,
                deviceError,
                isPending,
                devicesByCondition,
                devicesByConditionError,
                isDevicesByConditionPanding,
                lastUpdated,
                routeProps,
            } = this.props,
            { isDeviceSearch, showColumnDialog } = this.state,
            deviceData = isDeviceSearch ? devicesByCondition : devices,
            dataError = isDeviceSearch ? devicesByConditionError : deviceError,
            isDataPending = isDeviceSearch
                ? isDevicesByConditionPanding
                : isPending,
            gridProps = {
                onGridReady: this.onGridReady,
                rowData: isDataPending ? undefined : deviceData || [],
                onContextMenuChange: this.onContextMenuChange,
                t: this.props.t,
                searchPlaceholder: this.props.t("devices.searchPlaceholder"),
                searchAreaLabel: this.props.t("devices.ariaLabel"),
            },
            newDeviceFlyoutOpen = this.state.openFlyoutName === "new-device",
            simManagementFlyoutOpen =
                this.state.openFlyoutName === "sim-management",
            error = deviceGroupError || dataError;

        console.log(deviceData);
        return (
            <ComponentArray>
                <ContextMenuAgile
                    farChildren={[
                        <Protected permission={permissions.createDevices}>
                            {!this.state.isDeviceSearch && (
                                <Btn
                                    svg={svgs.plus}
                                    onClick={this.openNewDeviceFlyout}
                                >
                                    {t("devices.flyouts.new.contextMenuName")}
                                </Btn>
                            )}
                        </Protected>,
                        !this.state.isDeviceSearch && (
                            <RefreshBar
                                refresh={this.refreshDevices}
                                time={lastUpdated}
                                isPending={isPending}
                                t={t}
                                isShowIconOnly={true}
                            />
                        ),
                    ]}
                    priorityChildren={this.priorityChildren()}
                />
                {showColumnDialog && (
                    <ColumnDialog
                        show={showColumnDialog}
                        toggle={this.toggleColumnDialog}
                        columnOptions={this.state.columnOptions}
                        selectedOptions={this.state.selectedOptions}
                        updateColumns={this.updateColumns}
                        t={t}
                    />
                )}
                <PageContent className={css("devices-container")}>
                    <PageTitle
                        titleValue={
                            !this.state.isDeviceSearch
                                ? t("devices.title")
                                : t("devices.deviceSearchTitle")
                        }
                        descriptionValue={
                            !this.state.isDeviceSearch
                                ? t("devices.titleDescription")
                                : t("devices.deviceSearchTitleDescription")
                        }
                    />
                    {!!error && <AjaxError t={t} error={error} />}
                    {this.state.isDeviceSearch && <AdvanceSearchContainer />}
                    {!error && (
                        <DevicesGridContainer
                            useStaticCols={isDeviceSearch}
                            {...gridProps}
                            {...routeProps}
                            openPropertyEditorModal={this.openModal}
                            columnDefs={this.state.columnDefinitions}
                            gridControls={this.getGridControls()}
                        />
                    )}
                    {newDeviceFlyoutOpen && (
                        <DeviceNewContainer
                            onClose={this.closeFlyout}
                            mapping={
                                this.DeviceGroupColumnMappings.length === 0
                                    ? this.state.defaultColumnMappings
                                    : this.DeviceGroupColumnMappings
                            }
                        />
                    )}
                    {simManagementFlyoutOpen && (
                        <SIMManagementContainer onClose={this.closeFlyout} />
                    )}
                </PageContent>
                {this.getOpenModal()}
            </ComponentArray>
        );
    }
}
