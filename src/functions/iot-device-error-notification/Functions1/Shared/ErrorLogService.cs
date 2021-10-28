// <copyright file="ErrorLogService.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Mmm.Iot.Functions.IoTDeviceErrorNotification.Shared
{
    public class ErrorLogService
    {
        public async Task SaveDeviceErrorLogAsync(string tenant, string deviceId, string blobName)
        {
            try
            {
                string cosmosDbcollection = $"errorlog-{tenant}";
                int cosmosCollRus = Convert.ToInt32(Environment.GetEnvironmentVariable("CosmosDBRus", EnvironmentVariableTarget.Process));
                string cosmosDatabase = Environment.GetEnvironmentVariable("DeviceStreamDatabaseId", EnvironmentVariableTarget.Process);

                CosmosOperations docClient = await CosmosOperations.GetClientAsync();
                bool updateStatus = await docClient.CreateCollectionIfNotExistsAsync(cosmosDatabase, cosmosDbcollection, cosmosCollRus, CosmosOperation.Device);

                JObject deviceTwinJson = new JObject();
                deviceTwinJson.Add("id", Guid.NewGuid());
                deviceTwinJson.Add("deviceId", deviceId);
                deviceTwinJson.Add("name", blobName);
                deviceTwinJson.Add("blobName", $"{deviceId}/error/{blobName}");
                deviceTwinJson.Add("created", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                deviceTwinJson.Add("_schema", "errorLog"); // TODO: Move all to string const.
                docClient = await CosmosOperations.GetClientAsync();
                await docClient.SaveDocumentAsync(deviceTwinJson, this.GenerateCollectionLink(cosmosDatabase, cosmosDbcollection));
            }
            catch (Exception exception)
            {
                throw new ApplicationException($"Save Device Lifecycle operation failed: {exception}, tenant: {tenant}, deviceId {deviceId}");
            }
        }

        private string GenerateCollectionLink(string cosmosDatabase, string cosmosCollection)
        {
            return $"/dbs/{cosmosDatabase}/colls/{cosmosCollection}";
        }
    }
}