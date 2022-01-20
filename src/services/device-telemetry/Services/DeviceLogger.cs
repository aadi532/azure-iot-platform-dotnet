// <copyright file="DeviceLogger.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Azure.Documents.Client;
using Microsoft.Extensions.Logging;
using Mmm.Iot.Common.Services;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.Exceptions;
using Mmm.Iot.Common.Services.External.KustoStorage;
using Mmm.Iot.Common.Services.Helpers;
using Mmm.Iot.DeviceTelemetry.Services.Models;

namespace Mmm.Iot.DeviceTelemetry.Services
{
    public class DeviceLogger : IDeviceLogger
    {
        private const string FileUploadStore = "iot-file-upload";
        private const string DateFormat = "yyyy-MM-dd'T'HH:mm:sszzz";
        private const string DeviceLogTable = "DeviceLog";
        private const string TimeStamp = "TimeStamp";
        private const string DeviceIdKey = "DeviceId";
        private readonly AppConfig config;
        private readonly ILogger logger;
        private readonly IHttpContextAccessor httpContextAccessor;
        private readonly IKustoQueryClient kustoQueryClient;

        public DeviceLogger(
            AppConfig config,
            IHttpContextAccessor contextAccessor,
            ILogger<DeviceFileUploads> logger,
            IKustoQueryClient kustoQueryClient)
        {
            this.config = config;
            this.httpContextAccessor = contextAccessor;
            this.logger = logger;
            this.kustoQueryClient = kustoQueryClient;
        }

        public async Task<List<DeviceLog>> GetDevicelogsAsync(
            DateTimeOffset? from,
            DateTimeOffset? to,
            string order,
            int skip,
            int limit,
            string deviceId)
        {
            (string query, Dictionary<string, string> queryParameter) = QueryBuilder.GetKustoQuery(
                DeviceLogTable,
                deviceId,
                DeviceIdKey,
                from,
                TimeStamp,
                to,
                TimeStamp,
                order,
                TimeStamp,
                skip,
                limit);

            this.logger.LogDebug("Created Device log by DeviceId query {sql}", query);

            try
            {
                string database = $"IoT-{this.httpContextAccessor.HttpContext.Request.GetTenant()}";

                return await this.kustoQueryClient.ExecuteQueryAsync<DeviceLog>(database, query, queryParameter);
            }
            catch (ResourceNotFoundException e)
            {
                throw new ResourceNotFoundException($"No Device Logs exists", e);
            }
        }

        public async Task<List<LogCountByDevice>> GetlogCountByDeviceAsync(
            DateTimeOffset? from,
            DateTimeOffset? to,
            string order,
            int skip,
            int limit,
            string[] devices)
        {
            (string query, Dictionary<string, string> queryParameter) = QueryBuilder.GetDeviceLogCountKustoQuery(
                DeviceLogTable,
                from,
                TimeStamp,
                to,
                TimeStamp,
                order,
                TimeStamp,
                skip,
                limit,
                devices,
                DeviceIdKey);

            this.logger.LogDebug("Created log count by deviceid query {sql}", query);

            FeedOptions queryOptions = new FeedOptions
            {
                EnableCrossPartitionQuery = true,
                EnableScanInQuery = true,
            };

            try
            {
                string database = $"IoT-{this.httpContextAccessor.HttpContext.Request.GetTenant()}";

                return await this.kustoQueryClient.ExecuteQueryAsync<LogCountByDevice>(database, query, queryParameter);
            }
            catch (ResourceNotFoundException e)
            {
                throw new ResourceNotFoundException($"No Device Logs exists", e);
            }
        }
    }
}