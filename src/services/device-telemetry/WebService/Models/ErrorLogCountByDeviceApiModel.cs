// <copyright file="ErrorLogCountByDeviceApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class ErrorLogCountByDeviceApiModel
    {
        private int count;
        private string deviceId;

        public ErrorLogCountByDeviceApiModel(
            string deviceId,
            int count,
            List<ErrorLogApiModel> errorLogs)
        {
            this.Count = count;
            this.DeviceId = deviceId;
            this.ErrorLogs = errorLogs;
        }

        [JsonProperty(PropertyName = "Count")]
        public int Count
        {
            get { return this.count; }
            set { this.count = value; }
        }

        [JsonProperty(PropertyName = "DeviceId")]
        public string DeviceId
        {
            get { return this.deviceId; }
            set { this.deviceId = value; }
        }

        [JsonProperty(PropertyName = "ErrorLogs")]
        public List<ErrorLogApiModel> ErrorLogs { get; set; }
    }
}