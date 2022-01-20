// <copyright file="DeviceLog.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;

namespace Mmm.Iot.DeviceTelemetry.Services.Models
{
    public class DeviceLog
    {
        public DeviceLog(
            string deviceId,
            string type,
            string message,
            string stack,
            DateTime timeStamp)
        {
            this.DeviceId = deviceId;
            this.LogType = type;
            this.Message = message;
            this.CallStack = stack;
            this.TimeStamp = timeStamp;
        }

        public string DeviceId { get; set; }

        public string LogType { get; set; }

        public string Message { get; set; }

        public string CallStack { get; set; }

        public DateTimeOffset TimeStamp { get; set; }
    }
}