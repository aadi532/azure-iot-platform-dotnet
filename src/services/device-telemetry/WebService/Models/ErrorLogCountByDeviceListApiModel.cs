// <copyright file="ErrorLogCountByDeviceListApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Collections.Generic;
using System.Linq;
using Mmm.Iot.Common.Services.Models;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class ErrorLogCountByDeviceListApiModel
    {
        private readonly List<ErrorLogCountByDeviceApiModel> items;

        public ErrorLogCountByDeviceListApiModel(List<ErrorLog> errorLogs)
        {
            this.items = new List<ErrorLogCountByDeviceApiModel>();
            if (errorLogs != null)
            {
                var errorlogsByDevices = errorLogs.GroupBy(x => x.DeviceId);

                foreach (var errorLogsByDevices in errorlogsByDevices)
                {
                    List<ErrorLog> list = errorLogsByDevices.ToList();
                    int count = list.Count;

                    this.items.Add(new ErrorLogCountByDeviceApiModel(
                    errorLogsByDevices.Key,
                    count,
                    list.Select(x => new ErrorLogApiModel(x.ETag, x.Id, x.Name, x.BlobName, x.DateCreated)).ToList()));
                }
            }
        }

        [JsonProperty(PropertyName = "Items")]
        public List<ErrorLogCountByDeviceApiModel> Items
        {
            get { return this.items; }

            private set { }
        }
    }
}