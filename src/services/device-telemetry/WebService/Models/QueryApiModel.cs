// <copyright file="QueryApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Collections.Generic;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class QueryApiModel : BaseQueryApiModel
    {
        public QueryApiModel()
        {
            this.From = string.Empty;
            this.To = string.Empty;
            this.Order = null;
            this.Skip = null;
            this.Limit = null;
            this.Devices = new List<string>();
        }

        public QueryApiModel(
            string from,
            string to,
            string order,
            int? skip,
            int? limit,
            List<string> devices)
        {
            this.From = from;
            this.To = to;
            this.Order = order;
            this.Skip = skip;
            this.Limit = limit;
            this.Devices = devices;
        }

        [JsonProperty(PropertyName = "Devices")]
        public List<string> Devices { get; set; }
    }
}