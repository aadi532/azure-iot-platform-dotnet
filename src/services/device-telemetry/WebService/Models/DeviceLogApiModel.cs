// <copyright file="DeviceLogApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class DeviceLogApiModel
    {
        private const string DateFormat = "yyyy-MM-dd'T'HH:mm:sszzz";
        private DateTimeOffset timeStamp;

        public DeviceLogApiModel(
            string type,
            string message,
            string stack,
            DateTimeOffset dateCreated)
        {
            this.Type = type;
            this.Message = message;
            this.Stack = stack;
            this.timeStamp = dateCreated;
        }

        public DeviceLogApiModel(DeviceLog deviceLog)
        {
            this.Type = deviceLog.LogType;
            this.Message = deviceLog.Message;
            this.Stack = deviceLog.CallStack;
            this.timeStamp = deviceLog.TimeStamp;
        }

        [JsonProperty(PropertyName = "Type")]
        public string Type { get; set; }

        [JsonProperty(PropertyName = "Message")]
        public string Message { get; set; }

        [JsonProperty(PropertyName = "Stack")]
        public string Stack { get; set; }

        [JsonProperty(PropertyName = "TimeStamp")]
        public string TimeStamp => this.timeStamp.ToString(DateFormat);
    }
}