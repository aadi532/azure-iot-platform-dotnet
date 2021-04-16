// <copyright file="IoTHubMonitor.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Kusto.Data;
using Kusto.Data.Common;
using Kusto.Data.Net.Client;
using Microsoft.Azure.Cosmos.Table;
using Microsoft.Azure.Management.IotHub.Models;
using Microsoft.Azure.Management.Kusto;
using Microsoft.Azure.Management.Kusto.Models;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Clients.ActiveDirectory;
using Microsoft.Rest;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.External.AppConfiguration;
using Mmm.Iot.Common.Services.External.Azure;
using Mmm.Iot.Common.Services.External.BlobStorage;
using Mmm.Iot.Common.Services.External.KustoStorage;
using Mmm.Iot.Common.Services.External.TableStorage;
using Mmm.Iot.TenantManager.Services.Models;

namespace Mmm.Iot.TenantManager.Services.Tasks
{
    public class IoTHubMonitor : IHostedService, IDisposable
    {
        private readonly CancellationTokenSource stoppingCts = new CancellationTokenSource();
        private Task executingTask;
        private ITableStorageClient tableStorageClient;
        private IBlobStorageClient blobStorageClient;
        private IAzureManagementClient azureManagementClient;
        private IAppConfigurationClient appConfigurationClient;
        private AppConfig config;
        private IKustoCluterManagementClient kustoCluterManagementClient;
        private IKustoTableManagementClient kustoTableManagementClient;

        public IoTHubMonitor(ITableStorageClient tableStorageClient, IBlobStorageClient blobStorageClient, IAzureManagementClient azureManagementClient, IAppConfigurationClient appConfigurationClient, AppConfig config, IKustoCluterManagementClient kustoCluterManagementClient, IKustoTableManagementClient kustoTableManagementClient)
        {
            this.tableStorageClient = tableStorageClient;
            this.blobStorageClient = blobStorageClient;
            this.azureManagementClient = azureManagementClient;
            this.appConfigurationClient = appConfigurationClient;
            this.config = config;
            this.kustoCluterManagementClient = kustoCluterManagementClient;
            this.kustoTableManagementClient = kustoTableManagementClient;
        }

        public Task StartAsync(CancellationToken cancellationToken)
        {
            // Store the task we're executing
            if (this.executingTask == null)
            {
                this.executingTask = this.ExecuteAsync(this.stoppingCts.Token);
            }

            // If the task is completed then return it,
            // this will bubble cancellation and failure to the caller
            if (this.executingTask.IsCompleted)
            {
                return this.executingTask;
            }

            // Otherwise it's running
            return Task.CompletedTask;
        }

        [SuppressMessage("Usage", "VSTHRD003:Avoid awaiting foreign Tasks", Justification = "I added a timeout value")]
        public async Task StopAsync(CancellationToken cancellationToken)
        {
            // Stop called without start
            if (this.executingTask == null)
            {
                return;
            }

            try
            {
                // Signal cancellation to the executing method
                this.stoppingCts.Cancel();
            }
            finally
            {
                // Wait until the task completes or the stop token triggers
                await Task.WhenAny(this.executingTask, Task.Delay(5000, cancellationToken));
            }
        }

        public virtual void Dispose()
        {
            this.stoppingCts.Cancel();
            this.stoppingCts.Dispose();
        }

        protected async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    Console.WriteLine("Getting Items...");
                    TableQuery<TenantModel> query = new TableQuery<TenantModel>();
                    query.Where(TableQuery.CombineFilters(
                        TableQuery.GenerateFilterConditionForBool("IsIotHubDeployed", QueryComparisons.Equal, false),
                        TableOperators.And,
                        TableQuery.GenerateFilterConditionForDate("Timestamp", QueryComparisons.GreaterThan, DateTime.Now.AddHours(-1))));

                    var items = await this.tableStorageClient.QueryAsync("tenant", query, stoppingToken);
                    foreach (var item in items)
                    {
                        Console.WriteLine($"Processing {item.TenantId}");
                        try
                        {
                            await this.blobStorageClient.CreateBlobContainerIfNotExistsAsync(item.TenantId + "-iot-file-upload");
                            Console.WriteLine("File Upload Container Made");
                            IotHubDescription iothub = await this.azureManagementClient.IotHubManagementClient.RetrieveAsync(item.IotHubName, stoppingToken);

                            if (iothub.Properties.State == "Active")
                            {
                                Console.WriteLine("IoT Hub found");
                                var connectionString = this.azureManagementClient.IotHubManagementClient.GetConnectionString(iothub.Name);
                                await this.appConfigurationClient.SetValueAsync($"tenant:{item.TenantId}:iotHubConnectionString", connectionString);
                                Assembly assembly = Assembly.GetExecutingAssembly();
                                StreamReader reader = new StreamReader(assembly.GetManifestResourceStream("dps.json"));
                                string template = await reader.ReadToEndAsync();
                                template = string.Format(
                                    template,
                                    item.DpsName,
                                    this.config.Global.Location,
                                    connectionString);
                                await this.azureManagementClient.DeployTemplateAsync(template);

                                item.IsIotHubDeployed = true;
                                await this.tableStorageClient.InsertOrReplaceAsync<TenantModel>("tenant", item);

                                Console.WriteLine("Creating a DB in Data Explorer");

                                var softDeletePeriod = new TimeSpan(60, 0, 0, 0);
                                var databaseName = $"IoT-{item.TenantId}";

                                await this.kustoCluterManagementClient.CreatedDBInCluterAsync(databaseName, softDeletePeriod);

                                Console.WriteLine($"Created a {item.TenantId} DB in Data Explorer");

                                Console.WriteLine($"Creating telemetry table and mapping in {item.TenantId} DB in Data Explorer");

                                var tableName = "telemetry";
                                var tableMappingName = $"TelemetryEvents_JSON_Mapping-{item.TenantId}";
                                var tableSchema = new[]
                                {
                                    Tuple.Create("deviceId", "System.String"),
                                    Tuple.Create("data", "System.Object"),
                                    Tuple.Create("timeStamp", "System.Datetime"),
                                };
                                var mappingSchema = new ColumnMapping[]
                                {
                                    new ColumnMapping() { ColumnName = "deviceId", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.iothub-connection-device-id" } } },
                                    new ColumnMapping() { ColumnName = "data", ColumnType = "dynamic", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$" } } },
                                    new ColumnMapping() { ColumnName = "timeStamp", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.iothub-enqueuedtime" } } },
                                };

                                this.kustoTableManagementClient.CreateTable(tableName, tableSchema, databaseName);

                                this.kustoTableManagementClient.CreateTableMapping(tableMappingName, mappingSchema, tableName, databaseName);

                                string dataConnectName = $"telemetryDataConnect-{item.TenantId}";
                                string eventHubName = "telemetry";
                                string eventHubConsumerGroup = "$Default";

                                await this.kustoCluterManagementClient.AddEventHubDataConnectionAsync(dataConnectName, databaseName, tableName, tableMappingName, eventHubName, eventHubConsumerGroup);
                            }
                        }
                        catch (Microsoft.Azure.Management.IotHub.Models.ErrorDetailsException e)
                        {
                            if (e.Message == "Operation returned an invalid status code 'NotFound'")
                            {
                                Console.WriteLine("This is where we deploy IoT Hub");
                                Assembly assembly = Assembly.GetExecutingAssembly();
                                StreamReader reader = new StreamReader(assembly.GetManifestResourceStream("iothub.json"));
                                string template = await reader.ReadToEndAsync();
                                template = string.Format(
                                    template,
                                    item.IotHubName,
                                    this.config.Global.Location,
                                    this.config.Global.SubscriptionId,
                                    this.config.Global.ResourceGroup,
                                    item.TenantId,
                                    "$twin.properties.desired.batchedTelemetry",
                                    this.config.TenantManagerService.TelemetryEventHubConnectionString,
                                    this.config.TenantManagerService.TwinChangeEventHubConnectionString,
                                    this.config.TenantManagerService.LifecycleEventHubConnectionString,
                                    this.config.Global.StorageAccountConnectionString);
                                await this.azureManagementClient.DeployTemplateAsync(template);
                            }
                        }
                    }
                }
                catch (Exception e)
                {
                    Console.WriteLine("Error:");
                    Console.WriteLine(e.Message);
                    Console.WriteLine(e.StackTrace);
                }
                finally
                {
                    await Task.Delay(15000, stoppingToken);
                }
            }
        }
    }
}