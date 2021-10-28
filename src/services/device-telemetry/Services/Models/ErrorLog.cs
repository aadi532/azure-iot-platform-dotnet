// <copyright file="ErrorLog.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using Microsoft.Azure.Documents;

namespace Mmm.Iot.DeviceTelemetry.Services.Models
{
    public class ErrorLog
    {
        public ErrorLog(
            string etag,
            string id,
            long dateCreated,
            string deviceId,
            string blobName,
            string name)
        {
            this.ETag = etag;
            this.Id = id;
            this.DateCreated = DateTimeOffset.FromUnixTimeMilliseconds(dateCreated);
            this.DeviceId = deviceId;
            this.BlobName = blobName;
            this.Name = name;
        }

        public ErrorLog(Document doc)
        {
            if (doc != null)
            {
                this.ETag = doc.ETag;
                this.Id = doc.Id;
                this.DateCreated = DateTimeOffset.FromUnixTimeMilliseconds(doc.GetPropertyValue<long>("created"));
                this.DeviceId = doc.GetPropertyValue<string>("deviceId");
                this.BlobName = doc.GetPropertyValue<string>("blobName");
                this.Name = doc.GetPropertyValue<string>("name");
            }
        }

        public string ETag { get; set; }

        public string Id { get; set; }

        public string DeviceId { get; set; }

        public string Name { get; set; }

        public string BlobName { get; set; }

        public DateTimeOffset DateCreated { get; set; }
    }
}