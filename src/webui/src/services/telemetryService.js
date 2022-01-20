// Copyright (c) Microsoft. All rights reserved.

import { stringify } from "query-string";
import Config from "app.config";
import { HttpClient } from "utilities/httpClient";
import { of, throwError } from "rxjs";
import {
    toActiveAlertsModel,
    toAlertForRuleModel,
    toAlertsForRuleModel,
    toAlertsModel,
    toMessagesModel,
    toRuleModel,
    toRulesModel,
    toStatusModel,
    toTelemetryRequestModel,
    toDeviceUploadsModel,
    toDeviceLogsModel,
    toLogCountByDevicesModel,
} from "./models";
import { map, catchError } from "rxjs/operators";

const ENDPOINT = Config.serviceUrls.telemetry;
const ContinueAsEmptyMessages = { messages: {} };
const ContinueAsEmptyAlarms = { alarms: {}, alarm: {} };

/** Contains methods for calling the telemetry service */
export class TelemetryService {
    /** Returns the status properties for the telemetry service */
    static getStatus() {
        return HttpClient.get(`${ENDPOINT}status`).pipe(map(toStatusModel));
    }

    /** Returns a list of rules */
    static getRules(params = {}) {
        return HttpClient.get(`${ENDPOINT}rules?${stringify(params)}`, {
            timeout: 120000,
        }).pipe(
            catchError((error) => this.catch404(error, ContinueAsEmptyAlarms)),
            map(toRulesModel)
        );
    }

    /** creates a new rule */
    static createRule(rule) {
        return HttpClient.post(`${ENDPOINT}rules`, rule).pipe(map(toRuleModel));
    }

    /** updates an existing rule */
    static updateRule(id, rule) {
        return HttpClient.put(`${ENDPOINT}rules/${id}`, rule).pipe(
            map(toRuleModel)
        );
    }

    /** Returns a list of alarms (all statuses) */
    static getAlerts(params = {}) {
        if (params.devices && !Array.isArray(params.devices)) {
            params.devices = params.devices.split(",");
        }
        let body = toTelemetryRequestModel(params);
        return HttpClient.post(`${ENDPOINT}alarms`, body).pipe(
            catchError((error) => this.catch404(error, ContinueAsEmptyAlarms)),
            map(toAlertsModel)
        );
    }

    /** Returns a list of active alarms (open or ack) */
    static getActiveAlerts(params = {}) {
        if (params.devices && !Array.isArray(params.devices)) {
            params.devices = params.devices.split(",");
        }
        let body = toTelemetryRequestModel(params);
        return HttpClient.post(`${ENDPOINT}alarmsbyrule`, body).pipe(
            catchError((error) => this.catch404(error, ContinueAsEmptyAlarms)),
            map(toActiveAlertsModel)
        );
    }

    /** Returns a list of alarms created from a given rule */
    static getAlertsForRule(id, params = {}) {
        if (params.devices && !Array.isArray(params.devices)) {
            params.devices = params.devices.split(",");
        }
        let body = toTelemetryRequestModel(params);
        return HttpClient.post(`${ENDPOINT}alarmsbyrule/${id}`, body).pipe(
            catchError((error) => this.catch404(error, ContinueAsEmptyAlarms)),
            map(toAlertsForRuleModel)
        );
    }

    /** Returns a list of alarms created from a given rule */
    static updateAlertStatus(id, Status) {
        return HttpClient.patch(`${ENDPOINT}alarms/${encodeURIComponent(id)}`, {
            Status,
        }).pipe(map(toAlertForRuleModel));
    }

    static deleteAlerts(ids) {
        const request = { Items: ids };
        return HttpClient.post(`${ENDPOINT}alarms!delete`, request);
    }

    /** Returns a telemetry events */
    static getTelemetryByMessages(params = {}) {
        let body = toTelemetryRequestModel(params);
        return HttpClient.post(`${ENDPOINT}messages`, body).pipe(
            catchError((error) =>
                this.catch404(error, ContinueAsEmptyMessages)
            ),
            map(toMessagesModel)
        );
    }

    static getTelemetryByDeviceId(devices = [], timeInterval) {
        console.log(timeInterval);
        return TelemetryService.getTelemetryByMessages({
            from: "NOW-" + timeInterval,
            to: "NOW",
            order: "desc",
            devices,
        });
    }

    static getTelemetryByDeviceIdP1M(devices = []) {
        return TelemetryService.getTelemetryByMessages({
            from: "NOW-PT1M",
            to: "NOW",
            order: "desc",
            devices,
        });
    }

    static getTelemetryByDeviceIdP15M(devices = []) {
        return TelemetryService.getTelemetryByMessages({
            from: "NOW-PT15M",
            to: "NOW",
            order: "desc",
            devices,
        });
    }

    static deleteRule(id) {
        return HttpClient.delete(`${ENDPOINT}rules/${id}`).pipe(
            map(() => ({ deletedRuleId: id }))
        );
    }

    static getDeviceUploads(id) {
        var response = HttpClient.get(`${ENDPOINT}deviceFiles/${id}`).pipe(
            map(toDeviceUploadsModel)
        );
        return response;
    }

    static getDeviceUploadsFileContent(blobName) {
        var response = HttpClient.post(
            `${ENDPOINT}deviceFiles/download`,
            { BlobName: blobName },
            { responseType: "blob" }
        );
        return response;
    }

    static getDeviceLogs(deviceId, timeInterval) {
        let body = toTelemetryRequestModel({
            from: "NOW-" + timeInterval,
            to: "NOW",
            order: "desc",
        });
        return HttpClient.post(`${ENDPOINT}deviceLog/${deviceId}`, body).pipe(
            catchError((error) =>
                this.catch404(error, ContinueAsEmptyMessages)
            ),
            map(toDeviceLogsModel)
        );
    }

    static getLogCountByDevice(timeInterval) {
        let body = toTelemetryRequestModel({
            ...timeInterval,
        });
        return HttpClient.post(
            `${ENDPOINT}deviceLog/LogCountByDevice`,
            body
        ).pipe(
            catchError((error) =>
                this.catch404(error, ContinueAsEmptyMessages)
            ),
            map(toLogCountByDevicesModel)
        );
    }

    /*
    a 404 is thrown by some device telemetry apis when a collection does not exist
    for instances where this is the case, we want to catch this 404 and simply return no data instead
    */
    static catch404(error, continueAs) {
        return error.status === 404 ? of(continueAs) : throwError(error);
    }
}
