// <copyright file="LogCountByDeviceListApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Collections.Generic;
using System.Linq;
using Mmm.Iot.Common.Services.Models;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class LogCountByDeviceListApiModel
    {
        private readonly List<LogCountByDeviceApiModel> items;

        public LogCountByDeviceListApiModel(List<LogCountByDevice> logs)
        {
            this.items = new List<LogCountByDeviceApiModel>();
            if (logs != null)
            {
                foreach (LogCountByDevice log in logs)
                {
                    this.Items.Add(new LogCountByDeviceApiModel(log));
                }
            }
        }

        [JsonProperty(PropertyName = "Items")]
        public List<LogCountByDeviceApiModel> Items
        {
            get { return this.items; }

            private set { }
        }
    }
}