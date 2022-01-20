// <copyright file="DeviceLogController.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.Exceptions;
using Mmm.Iot.Common.Services.Filters;
using Mmm.Iot.DeviceTelemetry.Services;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Mmm.Iot.DeviceTelemetry.WebService.Controllers.Helpers;
using Mmm.Iot.DeviceTelemetry.WebService.Models;

namespace Mmm.Iot.DeviceTelemetry.WebService.Controllers
{
    [Route("v1/[controller]")]
    [TypeFilter(typeof(ExceptionsFilterAttribute))]
    public class DeviceLogController : Controller
    {
        private readonly AppConfig appConfig;
        private readonly IDeviceLogger deviceLogger;
        private int deviceLimit = 1000;

        public DeviceLogController(AppConfig appConfig, IDeviceLogger deviceLogger)
        {
            this.appConfig = appConfig;
            this.deviceLogger = deviceLogger;
        }

        [HttpPost("{deviceId}")]
        [Authorize("ReadAll")]
        public async Task<DeviceLogListApiModel> GetLogsByDevices([FromRoute] string deviceId, [FromBody] BaseQueryApiModel body)
        {
            return await this.GetLogsByDeviceHelper(body.From, body.To, body.Order, body.Skip, body.Limit, deviceId);
        }

        [HttpPost("LogCountByDevice")]
        [Authorize("ReadAll")]
        public async Task<LogCountByDeviceListApiModel> GetLogCountByDevices([FromBody] QueryApiModel body)
        {
            string[] deviceIds = body.Devices == null
                ? new string[0]
                : body.Devices.ToArray();

            return await this.GetLogCountByDeviceHelper(body.From, body.To, body.Order, body.Skip, body.Limit, deviceIds);
        }

        private async Task<DeviceLogListApiModel> GetLogsByDeviceHelper(
            string from,
            string to,
            string order,
            int? skip,
            int? limit,
            string deviceId)
        {
            DateTimeOffset? fromDate = DateHelper.ParseDate(from);
            DateTimeOffset? toDate = DateHelper.ParseDate(to);

            if (order == null)
            {
                order = "asc";
            }

            if (skip == null)
            {
                skip = 0;
            }

            if (limit == null)
            {
                limit = 1000;
            }

            if (string.IsNullOrEmpty(deviceId))
            {
                // this.logger.LogWarning("The client requested too many devices {count}", deviceIds.Length);
                throw new BadRequestException("DeviceId cannot be empty");
            }

            List<DeviceLog> deviceLogs
                = await this.deviceLogger.GetDevicelogsAsync(
                    fromDate,
                    toDate,
                    order,
                    skip.Value,
                    limit.Value,
                    deviceId);

            return new DeviceLogListApiModel(deviceLogs);
        }

        private async Task<LogCountByDeviceListApiModel> GetLogCountByDeviceHelper(
            string from,
            string to,
            string order,
            int? skip,
            int? limit,
            string[] deviceIds)
        {
            DateTimeOffset? fromDate = DateHelper.ParseDate(from);
            DateTimeOffset? toDate = DateHelper.ParseDate(to);

            if (order == null)
            {
                order = "asc";
            }

            if (skip == null)
            {
                skip = 0;
            }

            if (limit == null)
            {
                limit = 1000;
            }

            /* TODO: move this logic to the storage engine, depending on the
             * storage type the limit will be different. DEVICE_LIMIT is CosmosDb
             * limit for the IN clause.
             */

            bool processIOTHubBeyondLimit = false;
            try
            {
                this.deviceLimit = this.appConfig.Global.Limits.MaximumDeviceCount;
                processIOTHubBeyondLimit = this.appConfig.Global.Limits.ProcessIOTHubBeyondLimit;
            }
            catch
            {
                this.deviceLimit = 1000;
                processIOTHubBeyondLimit = false;
            }

            if (!processIOTHubBeyondLimit && deviceIds.Length > this.deviceLimit)
            {
                // this.logger.LogWarning("The client requested too many devices {count}", deviceIds.Length);
                throw new BadRequestException("The number of devices cannot exceed " + this.deviceLimit);
            }

            List<LogCountByDevice> logCountList
                = await this.deviceLogger.GetlogCountByDeviceAsync(
                    fromDate,
                    toDate,
                    order,
                    skip.Value,
                    limit.Value,
                    deviceIds);

            return new LogCountByDeviceListApiModel(logCountList);
        }
    }
}