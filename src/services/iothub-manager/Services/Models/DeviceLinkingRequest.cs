// <copyright file="DeviceLinkingRequest.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Collections.Generic;

namespace Mmm.Iot.IoTHubManager.Services.Models
{
    public class DeviceLinkingRequest
    {
        public string ParentDeviceId { get; set; }

        public SourceCategory Category { get; set; }

        public IEnumerable<string> DeviceIds { get; set; }

        public string DeviceGroupId { get; set; }

        public string JobId { get; set; }
    }
}