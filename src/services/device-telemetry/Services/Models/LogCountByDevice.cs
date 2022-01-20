// <copyright file="LogCountByDevice.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;

namespace Mmm.Iot.DeviceTelemetry.Services.Models
{
    public class LogCountByDevice
    {
        public LogCountByDevice(
            string deviceId,
            int count,
            DateTime timeStamp)
        {
            this.DeviceId = deviceId;
            this.Count = count;
            this.TimeStamp = timeStamp;
        }

        public string DeviceId { get; set; }

        public int Count { get; set; }

        public DateTimeOffset TimeStamp { get; set; }
    }
}