// <copyright file="ErrorLogNotification.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Azure.EventHubs;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Host;
using Microsoft.Extensions.Logging;
using Mmm.Iot.Functions.IoTDeviceErrorNotification.Shared;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Mmm.Iot.Functions.IoTDeviceErrorNotification
{
    public static class ErrorLogNotification
    {
        [FunctionName("ErrorLogNotification")]
        public static async Task Run([EventHubTrigger(eventHubName: "blob-creation-events", Connection = "FileUploadConnectionString", ConsumerGroup = "$Default")] EventData[] events, ILogger log)
        {
            bool exceptionOccurred = false;
            List<Task> list = new List<Task>();

            try
            {
                var cosmosDbRus = Convert.ToInt32(Environment.GetEnvironmentVariable("CosmosDBRus", EnvironmentVariableTarget.Process));
                var cosmosDb = Environment.GetEnvironmentVariable("DeviceStreamDatabaseId", EnvironmentVariableTarget.Process);
                CosmosOperations docClient = await CosmosOperations.GetClientAsync();
                await docClient.CreateDatabaseIfNotExistsAsync(cosmosDb, cosmosDbRus);
            }
            catch (Exception)
            {
                log.LogError($"Error occurrred while creating Cosmos DB");
                throw;
            }

            foreach (EventData message in events)
            {
                string eventData = Encoding.UTF8.GetString(message.Body.Array);
                List<JObject> blobDatas = JsonConvert.DeserializeObject<List<JObject>>(eventData);

                foreach (var blobData in blobDatas)
                {
                    string blobSubject = blobData.GetValue("subject").ToString();

                    // Note: Re-evaluate the regex.
                    string pattern = @"([0-9A-Fa-f\-]{36})-iot-file-upload\/blobs\/(\w+)\/error\/(error[\w.-]*)";
                    MatchCollection matches = Regex.Matches(blobSubject, pattern);
                    Match match = matches.FirstOrDefault();
                    if (match != null)
                    {
                        string tenantId = match.Groups[1].Value;
                        string deviceId = match.Groups[2].Value;
                        string blobName = match.Groups[3].Value;

                        // log.LogInformation($"tenantId: {tenantId} Deviceid: {deviceId} Blobname: {blobName}");
                        ErrorLogService errorLogService = new ErrorLogService();
                        list.Add(Task.Run(async () => await errorLogService.SaveDeviceErrorLogAsync(tenantId, deviceId, blobName)));
                    }
                }
            }

            try
            {
                await Task.WhenAll(list.ToArray());
            }
            catch (Exception ex)
            {
                log.LogError($"Error occurrred : {ex.Message} StackTrace: {ex.StackTrace}  Inner Exception: {(string.IsNullOrEmpty(ex.StackTrace) ? string.Empty : ex.StackTrace)}");
                exceptionOccurred = true;
            }

            if (exceptionOccurred)
            {
                throw new Exception("Function Failed with exception");
            }
        }
    }
}