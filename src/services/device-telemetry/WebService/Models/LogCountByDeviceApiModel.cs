// <copyright file="LogCountByDeviceApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class LogCountByDeviceApiModel
    {
        private const string DateFormat = "yyyy-MM-dd'T'HH:mm:sszzz";
        private DateTimeOffset timeStamp;
        private int count;
        private string deviceId;

        public LogCountByDeviceApiModel(
            string deviceId,
            int count,
            DateTimeOffset timeStamp)
        {
            this.Count = count;
            this.DeviceId = deviceId;
            this.timeStamp = timeStamp;
        }

        public LogCountByDeviceApiModel(LogCountByDevice log)
        {
            this.Count = log.Count;
            this.DeviceId = log.DeviceId;
            this.timeStamp = log.TimeStamp;
        }

        [JsonProperty(PropertyName = "DeviceId")]
        public string DeviceId
        {
            get { return this.deviceId; }
            set { this.deviceId = value; }
        }

        [JsonProperty(PropertyName = "Count")]
        public int Count
        {
            get { return this.count; }
            set { this.count = value; }
        }

        [JsonProperty(PropertyName = "LastRecordedDate")]
        public string TimeStamp => this.timeStamp.ToString(DateFormat);
    }
}