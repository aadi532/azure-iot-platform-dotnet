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
using Microsoft.Azure.Cosmos.Table;
using Microsoft.Azure.Management.IotHub.Models;
using Microsoft.Extensions.Hosting;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.External.AppConfiguration;
using Mmm.Iot.Common.Services.External.Azure;
using Mmm.Iot.Common.Services.External.BlobStorage;
using Mmm.Iot.Common.Services.External.KustoStorage;
using Mmm.Iot.Common.Services.External.TableStorage;
using Mmm.Iot.Common.Services.Models;
using Mmm.Iot.TenantManager.Services.External;
using Mmm.Iot.TenantManager.Services.Models;

namespace Mmm.Iot.TenantManager.Services.Tasks
{
    public class IoTHubMonitor : IHostedService, IDisposable
    {
        private const string EventHubNamespaceFormat = "eventhub-{0}";
        private const string IoTDatabaseNameFormat = "IoT-{0}";
        private readonly CancellationTokenSource stoppingCts = new CancellationTokenSource();
        private Task executingTask;
        private ITableStorageClient tableStorageClient;
        private IBlobStorageClient blobStorageClient;
        private IAzureManagementClient azureManagementClient;
        private IAppConfigurationClient appConfigurationClient;
        private AppConfig config;
        private IKustoTableManagementClient kustoTableManagementClient;
        private IDeviceGroupsConfigClient deviceGroupClient;

        public IoTHubMonitor(ITableStorageClient tableStorageClient, IBlobStorageClient blobStorageClient, IAzureManagementClient azureManagementClient, IAppConfigurationClient appConfigurationClient, AppConfig config, IKustoTableManagementClient kustoTableManagementClient, IDeviceGroupsConfigClient deviceGroupsConfigClient)
        {
            this.tableStorageClient = tableStorageClient;
            this.blobStorageClient = blobStorageClient;
            this.azureManagementClient = azureManagementClient;
            this.appConfigurationClient = appConfigurationClient;
            this.config = config;
            this.kustoTableManagementClient = kustoTableManagementClient;
            this.deviceGroupClient = deviceGroupsConfigClient;
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

                                if (string.Equals(this.config.DeviceTelemetryService.Messages.TelemetryStorageType, TelemetryStorageTypeConstants.Ade, StringComparison.OrdinalIgnoreCase))
                                {
                                    string eventHubNameSpace = await this.SetupEventHub(item.TenantId);
                                    var databaseName = string.Format(IoTDatabaseNameFormat, item.TenantId);
                                    await this.azureManagementClient.KustoClusterManagementClient.CreateDatabaseIfNotExistAsync(databaseName);
                                    await this.ADXTelemetrySetup(item.TenantId, string.Format(IoTDatabaseNameFormat, item.TenantId), eventHubNameSpace);
                                    await this.ADXDeviceTwinSetup(item.TenantId, string.Format(IoTDatabaseNameFormat, item.TenantId), eventHubNameSpace);
                                    await this.ADXDeviceGroupSetup(item.TenantId, string.Format(IoTDatabaseNameFormat, item.TenantId), eventHubNameSpace);
                                    await this.ADXAlertsSetup(item.TenantId, string.Format(IoTDatabaseNameFormat, item.TenantId), eventHubNameSpace);

                                    // Blob Event Grid Event Subscription setup for Device Logging.
                                    reader = new StreamReader(assembly.GetManifestResourceStream("blobeventsubscription.json"));
                                    template = await reader.ReadToEndAsync();
                                    template = string.Format(
                                        template,
                                        $"{item.TenantId}-eventsub",
                                        this.config.Global.BlobEventGridSystemTopic.Name,
                                        this.config.Global.SubscriptionId,
                                        this.config.Global.ResourceGroup,
                                        eventHubNameSpace,
                                        $"{item.TenantId}-devicelogs",
                                        item.TenantId);
                                    await this.azureManagementClient.DeployTemplateAsync(template);
                                    await this.ADXDeviceLogsSetup(item.TenantId, string.Format(IoTDatabaseNameFormat, item.TenantId), eventHubNameSpace);

                                    // Migrate DeviceGroups Data into ADX
                                    await this.MigrateDeviceGroupsToADX(item.TenantId);
                                }

                                item.IsIotHubDeployed = true;
                                await this.tableStorageClient.InsertOrReplaceAsync<TenantModel>("tenant", item);
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
                                    this.config.TenantManagerService.DeviceTwinMirrorEventHubConnectionString,
                                    this.config.Global.StorageAccountConnectionString,
                                    this.config.Global.LogAnalytics.WorkspaceId,
                                    this.config.Global.DiagnosticSetting.Name);
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

        private async Task<string> SetupEventHub(string tenantId)
        {
            string eventHubNameSpace = string.Format(EventHubNamespaceFormat, tenantId.Substring(0, 8));

            await this.azureManagementClient.EventHubsManagementClient.CreateNamespaceIfNotExist(eventHubNameSpace);
            var accessKeys = await this.azureManagementClient.EventHubsManagementClient.GetPrimaryConnectionString(eventHubNameSpace);
            await this.appConfigurationClient.SetValueAsync($"tenant:{tenantId}:eventHubConn", accessKeys.PrimaryConnectionString);
            await this.appConfigurationClient.SetValueAsync($"tenant:{tenantId}:eventHubPrimaryKey", accessKeys.PrimaryKey);

            this.azureManagementClient.EventHubsManagementClient.CreateEventHub(eventHubNameSpace, $"{tenantId}-telemetry");

            this.azureManagementClient.EventHubsManagementClient.CreateEventHub(eventHubNameSpace, $"{tenantId}-devicetwin");

            this.azureManagementClient.EventHubsManagementClient.CreateEventHub(eventHubNameSpace, $"{tenantId}-devicegroup");

            this.azureManagementClient.EventHubsManagementClient.CreateEventHub(eventHubNameSpace, $"{tenantId}-alerts");

            this.azureManagementClient.EventHubsManagementClient.CreateEventHub(eventHubNameSpace, $"{tenantId}-devicelogs");

            // Set the Refresh Key to new connectionstring so the functions can update
            // values from AppConfiguration
            await this.appConfigurationClient.SetValueAsync("tenant:refreshappconfig", tenantId);

            return eventHubNameSpace;
        }

        private async Task ADXTelemetrySetup(string tenantId, string databaseName, string eventHubNameSpace)
        {
            Console.WriteLine($"Creating telemetry table and mapping in {tenantId} DB in Data Explorer");

            var tableName = "Telemetry";
            var tableMappingName = $"TelemetryEvents_JSON_Mapping-{tenantId}";
            var tableSchema = new[]
            {
                  Tuple.Create("DeviceId", "System.String"),
                  Tuple.Create("Data", "System.Object"),
                  Tuple.Create("TimeStamp", "System.Datetime"),
            };
            var mappingSchema = new ColumnMapping[]
            {
                  new ColumnMapping() { ColumnName = "DeviceId", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.deviceId" } } },
                  new ColumnMapping() { ColumnName = "Data", ColumnType = "dynamic", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.data" } } },
                  new ColumnMapping() { ColumnName = "TimeStamp", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.dateTimeReceived" } } },
            };

            string dataConnectionName = $"TelemetryDataConnect-{tenantId.Substring(0, 8)}";
            string eventHubName = $"{tenantId}-telemetry";

            await this.ADXTableSetup(tenantId, databaseName, tableName, tableSchema, tableMappingName, mappingSchema, dataConnectionName, eventHubNameSpace, eventHubName);

            this.kustoTableManagementClient.AlterTableRetentionPolicy(tableName, databaseName, new TimeSpan(30, 0, 0, 0), DataRecoverability.Disabled);
        }

        private async Task ADXDeviceTwinSetup(string tenantId, string databaseName, string eventHubNameSpace)
        {
            Console.WriteLine($"Creating telemetry table and mapping in {tenantId} DB in Data Explorer");

            var tableName = "DeviceTwin";
            var tableMappingName = $"DeviceTwinEvents_JSON_Mapping-{tenantId}";
            var tableSchema = new[]
            {
                  Tuple.Create("DeviceId", "System.String"),
                  Tuple.Create("Twin", "System.Object"),
                  Tuple.Create("TimeStamp", "System.Datetime"),
                  Tuple.Create("DeviceCreatedDate", "System.Datetime"),
                  Tuple.Create("IsDeleted", "System.Boolean"),
            };
            var mappingSchema = new ColumnMapping[]
            {
                  new ColumnMapping() { ColumnName = "DeviceId", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.deviceId" } } },
                  new ColumnMapping() { ColumnName = "Twin", ColumnType = "dynamic", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.data" } } },
                  new ColumnMapping() { ColumnName = "TimeStamp", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.timeStamp" } } },
                  new ColumnMapping() { ColumnName = "DeviceCreatedDate", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.deviceCreatedDate" } } },
                  new ColumnMapping() { ColumnName = "IsDeleted", ColumnType = "bool", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.isDeleted" } } },
            };

            string dataConnectionName = $"DeviceTwinDataConnect-{tenantId.Substring(0, 8)}";
            string eventHubName = $"{tenantId}-devicetwin";

            await this.ADXTableSetup(tenantId, databaseName, tableName, tableSchema, tableMappingName, mappingSchema, dataConnectionName, eventHubNameSpace, eventHubName);
        }

        private async Task ADXDeviceGroupSetup(string tenantId, string databaseName, string eventHubNameSpace)
        {
            Console.WriteLine($"Creating telemetry table and mapping in {tenantId} DB in Data Explorer");

            var tableName = "DeviceGroup";
            var tableMappingName = $"DeviceGroup_JSON_Mapping-{tenantId}";
            var tableSchema = new[]
            {
                  Tuple.Create("DeviceGroupId", "System.String"),
                  Tuple.Create("DeviceGroupName", "System.String"),
                  Tuple.Create("DeviceGroupConditions", "System.String"),
                  Tuple.Create("TimeStamp", "System.Datetime"),
                  Tuple.Create("IsDeleted", "System.Boolean"),
            };
            var mappingSchema = new ColumnMapping[]
            {
                  new ColumnMapping() { ColumnName = "DeviceGroupId", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.DeviceGroupId" } } },
                  new ColumnMapping() { ColumnName = "DeviceGroupName", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.DeviceGroupName" } } },
                  new ColumnMapping() { ColumnName = "DeviceGroupConditions", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.DeviceGroupConditions" } } },
                  new ColumnMapping() { ColumnName = "TimeStamp", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.TimeStamp" } } },
                  new ColumnMapping() { ColumnName = "IsDeleted", ColumnType = "bool", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$.IsDeleted" } } },
            };

            string dataConnectionName = $"DeviceGroupDataConnect-{tenantId.Substring(0, 8)}";
            string eventHubName = $"{tenantId}-devicegroup";

            await this.ADXTableSetup(tenantId, databaseName, tableName, tableSchema, tableMappingName, mappingSchema, dataConnectionName, eventHubNameSpace, eventHubName);
        }

        private async Task ADXTableSetup(
            string tenantId,
            string databaseName,
            string tableName,
            Tuple<string, string>[] tableSchema,
            string tableMappingName,
            ColumnMapping[] mappingSchema,
            string dataConnectionName,
            string eventHubNameSpace,
            string eventHubName)
        {
            this.kustoTableManagementClient.CreateTable(tableName, tableSchema, databaseName);

            this.kustoTableManagementClient.CreateTableMapping(tableMappingName, mappingSchema, tableName, databaseName);

            this.kustoTableManagementClient.EnableStreamingIngestionPolicyToTable(tableName, databaseName);

            string consumerGroup = "$Default";

            await this.azureManagementClient.KustoClusterManagementClient.AddEventHubDataConnectionAsync(dataConnectionName, databaseName, tableName, tableMappingName, eventHubNameSpace, eventHubName, consumerGroup);
        }

        private async Task ADXAlertsSetup(string tenantId, string databaseName, string eventHubNameSpace)
        {
            Console.WriteLine($"Creating RawAlerts table and mapping in {tenantId} DB in Data Explorer");

            var tableName = "RawAlerts";
            var tableMappingName = $"RawAlertsMapping-{tenantId}";
            var tableSchema = new[]
            {
                  Tuple.Create("Data", "System.Object"),
            };
            var mappingSchema = new ColumnMapping[]
            {
                  new ColumnMapping() { ColumnName = "Data", ColumnType = "dynamic", Properties = new Dictionary<string, string>() { { MappingConsts.Path, "$" } } },
            };

            string dataConnectionName = $"AlertsDataConnect-{tenantId.Substring(0, 8)}";
            string eventHubName = $"{tenantId}-alerts";

            this.ADXTableSetup(tenantId, databaseName, tableName, tableSchema, tableMappingName, mappingSchema);

            this.kustoTableManagementClient.EnableStreamingIngestionPolicyToTable(tableName, databaseName);

            DataUpdatePolicy dataUpdatePolicy = new DataUpdatePolicy(
                                                isEnabled: false,
                                                source: null,
                                                query: null,
                                                isTransactional: true,
                                                propagateIngestionProperties: false);

            List<DataUpdatePolicy> policyList = new List<DataUpdatePolicy>();
            policyList.Add(dataUpdatePolicy);

            this.kustoTableManagementClient.AlterTablePolicy(tableName, databaseName, policyList);

            this.kustoTableManagementClient.AlterTableRetentionPolicy(tableName, databaseName, new TimeSpan(0, 0, 0, 0), DataRecoverability.Disabled);

            string consumerGroup = "$Default";

            await this.azureManagementClient.KustoClusterManagementClient.AddEventHubDataConnectionAsync(dataConnectionName, databaseName, tableName, tableMappingName, eventHubNameSpace, eventHubName, consumerGroup);

            var alertsTableName = "Alerts";
            var alertsTableSchema = new[]
            {
                  Tuple.Create("Id", "System.String"),
                  Tuple.Create("DateCreated", "System.Datetime"),
                  Tuple.Create("DateModified", "System.Datetime"),
                  Tuple.Create("Description", "System.String"),
                  Tuple.Create("GroupId", "System.String"),
                  Tuple.Create("DeviceId", "System.String"),
                  Tuple.Create("Status", "System.String"),
                  Tuple.Create("RuleId", "System.String"),
                  Tuple.Create("RuleSeverity", "System.String"),
                  Tuple.Create("RuleDescription", "System.String"),
                  Tuple.Create("IsDeleted", "System.Boolean"),
            };

            this.ADXTableSetup(tenantId, databaseName, alertsTableName, alertsTableSchema);

            string functionName = "ProcessAlerts";
            string functionQueryFormat = @"{{ {0} | project Id = iif(isempty(tostring(Data[""id""])), tostring(new_guid()), tostring(Data[""id""])), DateCreated = unixtime_milliseconds_todatetime(todouble(Data[""created""])), DateModified = unixtime_milliseconds_todatetime(todouble(Data[""modified""])), Description = tostring(Data[""description""]), GroupId = tostring(Data[""groupId""]), DeviceId = tostring(Data[""deviceId""]), Status = tostring(Data[""status""]), RuleId = tostring(Data[""ruleId""]), RuleSeverity = tostring(Data[""ruleSeverity""]), ruleDescription = tostring(Data[""ruleDescription""]), IsDeleted = iif(isempty(tostring(Data[""isDeleted""])), false, tobool(Data[""isDeleted""]))}}";

            string functionQuery = string.Format(functionQueryFormat, tableName);

            this.kustoTableManagementClient.CreateOrAlterFunction(functionName, null, functionQuery, databaseName);

            DataUpdatePolicy alertsDataUpdatePolicy = new DataUpdatePolicy(
                                                isEnabled: true,
                                                source: tableName,
                                                query: $"{functionName}()",
                                                isTransactional: true,
                                                propagateIngestionProperties: false);

            List<DataUpdatePolicy> alertsPolicyList = new List<DataUpdatePolicy>();
            alertsPolicyList.Add(alertsDataUpdatePolicy);

            this.kustoTableManagementClient.AlterTablePolicy(alertsTableName, databaseName, alertsPolicyList);
        }

        private async Task ADXDeviceLogsSetup(string tenantId, string databaseName, string eventHubNameSpace)
        {
            Console.WriteLine($"Creating deviceLogs table and mapping in {tenantId} DB in Data Explorer");

            var tableName = "DeviceLogs";
            var tableMappingName = $"DevicelogEvents_JSON_Mapping-{tenantId}";
            var tableSchema = new[]
            {
                  Tuple.Create("DeviceId", "System.String"),
                  Tuple.Create("LogType", "System.String"),
                  Tuple.Create("Message", "System.String"),
                  Tuple.Create("CallStack", "System.String"),
                  Tuple.Create("TimeStamp", "System.Datetime"),
            };
            var mappingSchema = new ColumnMapping[]
            {
                  new ColumnMapping() { ColumnName = "DeviceId", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Ordinal, "0" } } },
                  new ColumnMapping() { ColumnName = "LogType", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Ordinal, "1" } } },
                  new ColumnMapping() { ColumnName = "Message", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Ordinal, "2" } } },
                  new ColumnMapping() { ColumnName = "CallStack", ColumnType = "string", Properties = new Dictionary<string, string>() { { MappingConsts.Ordinal, "3" } } },
                  new ColumnMapping() { ColumnName = "TimeStamp", ColumnType = "datetime", Properties = new Dictionary<string, string>() { { MappingConsts.Ordinal, "4" } } },
            };

            string dataConnectionName = $"DeviceLogsDataConnect-{tenantId.Substring(0, 8)}";
            string eventHubName = $"{tenantId}-devicelogs";

            this.kustoTableManagementClient.CreateTable(tableName, tableSchema, databaseName);

            this.kustoTableManagementClient.CreateTableMapping(tableMappingName, mappingSchema, tableName, databaseName, Kusto.Data.Ingestion.IngestionMappingKind.Csv);

            this.kustoTableManagementClient.EnableStreamingIngestionPolicyToTable(tableName, databaseName);

            string consumerGroup = "$Default";

            await this.azureManagementClient.KustoClusterManagementClient.AddBlobStorageDataConnectionAsync(dataConnectionName, databaseName, tableName, tableMappingName, eventHubNameSpace, eventHubName, consumerGroup, DataFormat.CSV);

            this.kustoTableManagementClient.AlterTableRetentionPolicy(tableName, databaseName, new TimeSpan(365, 0, 0, 0), DataRecoverability.Disabled);
        }

        private void ADXTableSetup(
            string tenantId,
            string databaseName,
            string tableName,
            Tuple<string, string>[] tableSchema,
            string tableMappingName = null,
            ColumnMapping[] mappingSchema = null)
        {
            this.kustoTableManagementClient.CreateTable(tableName, tableSchema, databaseName);

            if (tableMappingName != null && mappingSchema != null)
            {
                this.kustoTableManagementClient.CreateTableMapping(tableMappingName, mappingSchema, tableName, databaseName);
            }
        }

        private async Task MigrateDeviceGroupsToADX(string tenantId)
        {
            Console.WriteLine($"Migration DeviceGroups for {tenantId} to Data Explorer");

            try
            {
                await this.deviceGroupClient.MigrateDeviceGroupsAsync(tenantId);
            }
            catch (Exception e)
            {
                Console.WriteLine("Error:");
                Console.WriteLine(e.Message);
                Console.WriteLine(e.StackTrace);
            }
        }
    }
}