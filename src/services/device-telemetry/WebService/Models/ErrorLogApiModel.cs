// <copyright file="ErrorLogApiModel.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using Mmm.Iot.DeviceTelemetry.Services.Models;
using Newtonsoft.Json;

namespace Mmm.Iot.DeviceTelemetry.WebService.Models
{
    public class ErrorLogApiModel
    {
        private const string DateFormat = "yyyy-MM-dd'T'HH:mm:sszzz";
        private DateTimeOffset dateCreated;

        public ErrorLogApiModel(
            string etag,
            string id,
            string name,
            string blobName,
            DateTimeOffset dateCreated)
        {
            this.ETag = etag;
            this.Id = id;
            this.Name = name;
            this.BlobName = blobName;
            this.dateCreated = dateCreated;
        }

        [JsonProperty(PropertyName = "ETag")]
        public string ETag { get; set; }

        [JsonProperty(PropertyName = "Id")]
        public string Id { get; set; }

        [JsonProperty(PropertyName = "Name")]
        public string Name { get; set; }

        [JsonProperty(PropertyName = "BlobName")]
        public string BlobName { get; set; }

        [JsonProperty(PropertyName = "DateCreated")]
        public string DateCreated => this.dateCreated.ToString(DateFormat);
    }
}