// <copyright file="DeviceLogListApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Collections.Generic;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class DeviceLogListApiModel
    {
        public DeviceLogListApiModel(IEnumerable<DeviceLog> deviceLogs)
        {
            this.Items = new List<DeviceLogApiModel>();
            if (deviceLogs != null)
            {
                foreach (DeviceLog deviceLog in deviceLogs)
                {
                    this.Items.Add(new DeviceLogApiModel(deviceLog));
                }
            }
        }

        [JsonProperty(PropertyName = "Items")]
        public List<DeviceLogApiModel> Items { get; set; }
    }
}