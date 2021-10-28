// <copyright file="DeviceFilesController.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Mmm.Iot.Common.Services;
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
    public class DeviceFilesController : Controller
    {
        private readonly IDeviceFileUploads deviceFileUploads;
        private readonly AppConfig appConfig;
        private int deviceLimit = 1000;

        public DeviceFilesController(IDeviceFileUploads deviceFileUploads, AppConfig appConfig)
        {
            this.deviceFileUploads = deviceFileUploads;
            this.appConfig = appConfig;
        }

        [HttpGet("{deviceId}")]
        [Authorize("ReadAll")]
        public async Task<DeviceFileListApiModel> GetDeviceUploads(string deviceId)
        {
            var deviceFiles = await this.deviceFileUploads.GetDeviceUploads(this.GetTenantId(), deviceId);

            return new DeviceFileListApiModel(deviceFiles);
        }

        [HttpPost("Download")]
        [Authorize("ReadAll")]
        public async Task<IActionResult> GetFileContents([FromBody] DownloadRequest downloadRequest)
        {
            var blob = this.deviceFileUploads.Download(this.GetTenantId(), downloadRequest.BlobName);
            Stream blobStream = await blob.OpenReadAsync();
            return this.File(blobStream, blob.Properties.ContentType, blob.Name);
        }

        [HttpPost("ErrorLogUploads")]
        [Authorize("ReadAll")]
        public async Task<ErrorLogCountByDeviceListApiModel> GetErrorLogUploadsByDevices([FromBody] QueryApiModel body)
        {
            string[] deviceIds = body.Devices == null
                ? new string[0]
                : body.Devices.ToArray();

            return await this.GetErrorLogsByDeviceHelper(body.From, body.To, body.Order, body.Skip, body.Limit, deviceIds);
        }

        private async Task<ErrorLogCountByDeviceListApiModel> GetErrorLogsByDeviceHelper(
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

            List<ErrorLog> errorLogCountlist
                = await this.deviceFileUploads.ListErrorlogAsync(
                    fromDate,
                    toDate,
                    order,
                    skip.Value,
                    limit.Value,
                    deviceIds);

            return new ErrorLogCountByDeviceListApiModel(errorLogCountlist);
        }
    }
}