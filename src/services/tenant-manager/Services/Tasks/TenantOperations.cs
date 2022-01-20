// <copyright file="TenantOperations.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Azure.Cosmos.Table;
using Microsoft.Extensions.Hosting;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.Exceptions;
using Mmm.Iot.Common.Services.External.AppConfiguration;
using Mmm.Iot.Common.Services.External.Azure;
using Mmm.Iot.Common.Services.External.BlobStorage;
using Mmm.Iot.Common.Services.External.Grafana;
using Mmm.Iot.Common.Services.External.KeyVault;
using Mmm.Iot.Common.Services.External.KustoStorage;
using Mmm.Iot.Common.Services.External.TableStorage;
using Mmm.Iot.Common.Services.Models;
using Mmm.Iot.TenantManager.Services.External;
using Mmm.Iot.TenantManager.Services.Models;

namespace Mmm.Iot.TenantManager.Services.Tasks
{
    public class TenantOperations : IHostedService, IDisposable
    {
        private const string TableName = "tenantOperations";
        private const string EventHubNamespaceFormat = "eventhub-{0}";
        private const string IoTDatabaseNameFormat = "IoT-{0}";
        private const string GrafanaOrgIdNameFormat = "tenant:{0}:grafanaOrgId";
        private const string GrafanaAPIKeyNameFormat = "Grafana--{0}--APIKey";
        private const string GrafanaUrlNameFormat = "tenant:{0}:grafanaUrl";
        private const string GrafanaPassword = "admin";
        private readonly CancellationTokenSource stoppingCts = new CancellationTokenSource();
        private readonly IIdentityGatewayClient identityGatewayClient;
        private Task executingTask;
        private ITableStorageClient tableStorageClient;
        private IBlobStorageClient blobStorageClient;
        private IAzureManagementClient azureManagementClient;
        private IAppConfigurationClient appConfigurationClient;
        private AppConfig config;
        private IGrafanaClient grafanaClient;
        private IKustoTableManagementClient kustoTableManagementClient;
        private IKeyVaultClient keyVaultClient;

        public TenantOperations(ITableStorageClient tableStorageClient, IBlobStorageClient blobStorageClient, IAzureManagementClient azureManagementClient, IAppConfigurationClient appConfigurationClient, AppConfig config, IGrafanaClient grafanaClient, IKustoTableManagementClient kustoTableManagementClient, IIdentityGatewayClient identityGatewayClient, IKeyVaultClient keyVaultClient)
        {
            this.tableStorageClient = tableStorageClient;
            this.blobStorageClient = blobStorageClient;
            this.azureManagementClient = azureManagementClient;
            this.appConfigurationClient = appConfigurationClient;
            this.config = config;
            this.grafanaClient = grafanaClient;
            this.kustoTableManagementClient = kustoTableManagementClient;
            this.identityGatewayClient = identityGatewayClient;
            this.keyVaultClient = keyVaultClient;
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
                Console.WriteLine("Getting Tenant Operations...");
                TableQuery<TenantOperationModel> query = new TableQuery<TenantOperationModel>();

                var items = await this.tableStorageClient.QueryAsync(TableName, query, stoppingToken);
                foreach (var item in items)
                {
                    try
                    {
                        switch (item.Type)
                        {
                            case TenantOperation.IoTHubDeletion:
                                Console.WriteLine($"Processing {item.TenantId}");
                                try
                                {
                                    Console.WriteLine($"Deleting {item.Name}...");

                                    await this.azureManagementClient.IotHubManagementClient.DeleteAsync(
                                        item.Name,
                                        stoppingToken);
                                    Console.WriteLine($"Deleting Table Operation Record...");
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }
                                catch (Microsoft.Azure.Management.IotHub.Models.ErrorDetailsException e)
                                {
                                    if (e.Message == "Operation returned an invalid status code 'NotFound'")
                                    {
                                        // Handle edge case
                                    }
                                }

                                break;
                            case TenantOperation.SaJobDeletion:
                                try
                                {
                                    var job = await this.azureManagementClient.AsaManagementClient.RetrieveAsync(
                                        item.Name,
                                        null,
                                        stoppingToken);
                                    Console.WriteLine($"SA job {item.Name} found");
                                    if (new List<string> { "Starting", "Running" }.Contains(job.JobState))
                                    {
                                        Console.WriteLine($"Stopping job");
                                        await this.azureManagementClient.AsaManagementClient.StopAsync(
                                            item.Name,
                                            null,
                                            stoppingToken);
                                    }
                                    else if (job.JobState != "Stopping")
                                    {
                                        Console.WriteLine($"Deleting job");
                                        await this.azureManagementClient.AsaManagementClient.DeleteAsync(
                                            item.Name,
                                            null,
                                            stoppingToken);
                                    }
                                }
                                catch (ResourceNotFoundException)
                                {
                                    // Item does not exist... delete the record
                                    Console.WriteLine($"SA job {item.Name} does not exist...deleting tenant operation");
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }

                                break;
                            case TenantOperation.SaJobCreation:
                                {
                                    await this.blobStorageClient.CreateBlobContainerIfNotExistsAsync(item.TenantId);
                                    Console.WriteLine("File Upload Container Made");
                                    var tenant = await this.tableStorageClient.RetrieveAsync<TenantModel>(
                                        "tenant",
                                        item.TenantId.Substring(0, 1),
                                        item.TenantId);

                                    this.azureManagementClient.IotHubManagementClient.AddConsumerGroup(
                                        tenant.IotHubName,
                                        "events",
                                        "sajobconsumergroup");
                                    Console.WriteLine("Event Consumer Group created");
                                    try
                                    {
                                        var job = await this.azureManagementClient.AsaManagementClient.RetrieveAsync(
                                            item.Name,
                                            null,
                                            stoppingToken);
                                        Console.WriteLine($"SA job {item.Name} found");
                                        Console.WriteLine($"Updating tenant table...");
                                        tenant.SAJobName = item.Name;
                                        await this.tableStorageClient.InsertOrMergeAsync("tenant", tenant);

                                        Console.WriteLine($"Deleting tenant operations table...");
                                        await this.tableStorageClient.DeleteAsync(TableName, item);
                                    }
                                    catch (ResourceNotFoundException)
                                    {
                                        // Item does not exist... delete the record
                                        Console.WriteLine($"SA job {item.Name} does not exist...creating it");
                                        Assembly assembly = Assembly.GetExecutingAssembly();
                                        string template = string.Empty;

                                        if (string.Equals(this.config.DeviceTelemetryService.Messages.TelemetryStorageType, TelemetryStorageTypeConstants.Ade, StringComparison.OrdinalIgnoreCase))
                                        {
                                            string eventHubNameSpace = string.Format(EventHubNamespaceFormat, item.TenantId.Substring(0, 8));
                                            string primaryKey = this.appConfigurationClient.GetValue($"tenant:{item.TenantId}:eventHubPrimaryKey");
                                            StreamReader reader = new StreamReader(assembly.GetManifestResourceStream("sajob_ADX.json"));

                                            template = await reader.ReadToEndAsync();
                                            template = string.Format(
                                                template,
                                                item.Name,
                                                this.config.Global.Location,
                                                this.config.Global.StorageAccount.Name,
                                                this.config.Global.StorageAccountConnectionString.Split(";")[2].Replace("AccountKey=", string.Empty),
                                                tenant.IotHubName,
                                                this.azureManagementClient.IotHubManagementClient.GetAccessKey(
                                                    tenant.IotHubName,
                                                    "iothubowner"),
                                                item.TenantId,
                                                this.config.Global.EventHub.Name,
                                                this.config.Global.EventHub.RootKey,
                                                this.config.Global.CosmosDb.AccountName,
                                                this.config.Global.CosmosDb.DocumentDbAuthKey,
                                                this.config.Global.LogAnalytics.WorkspaceId,
                                                this.config.Global.DiagnosticSetting.Name,
                                                $"{item.TenantId}-alerts",
                                                eventHubNameSpace,
                                                primaryKey);
                                        }
                                        else
                                        {
                                            StreamReader reader = new StreamReader(assembly.GetManifestResourceStream("sajob.json"));

                                            template = await reader.ReadToEndAsync();
                                            template = string.Format(
                                                template,
                                                item.Name,
                                                this.config.Global.Location,
                                                this.config.Global.StorageAccount.Name,
                                                this.config.Global.StorageAccountConnectionString.Split(";")[2].Replace("AccountKey=", string.Empty),
                                                tenant.IotHubName,
                                                this.azureManagementClient.IotHubManagementClient.GetAccessKey(
                                                    tenant.IotHubName,
                                                    "iothubowner"),
                                                item.TenantId,
                                                this.config.Global.EventHub.Name,
                                                this.config.Global.EventHub.RootKey,
                                                this.config.Global.CosmosDb.AccountName,
                                                this.config.Global.CosmosDb.DocumentDbAuthKey,
                                                this.config.Global.LogAnalytics.WorkspaceId,
                                                this.config.Global.DiagnosticSetting.Name);
                                        }

                                        await this.azureManagementClient.DeployTemplateAsync(template);
                                    }
                                }

                                break;
                            case TenantOperation.DpsDeletion:
                                try
                                {
                                    Console.WriteLine($"Deleting {item.Name}...");
                                    await this.azureManagementClient.DpsManagmentClient.DeleteAsync(item.Name);
                                }
                                catch (ResourceNotFoundException)
                                {
                                    Console.WriteLine($"Deleting Table Operation Record...");
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }

                                break;
                            case TenantOperation.GrafanaDashboardCreation:
                                {
                                    Console.WriteLine($"Creating Grafana Organization.");
                                    string orgId = await this.grafanaClient.CreateOrganization(item.TenantId);

                                    await this.appConfigurationClient.SetValueAsync(string.Format(GrafanaOrgIdNameFormat, item.TenantId), orgId);

                                    Console.WriteLine($"Creating APIKey for Organization:{orgId}");
                                    string apiKey = await this.grafanaClient.CreateAPIKey(orgId);

                                    await this.keyVaultClient.SetValueAsync(string.Format(GrafanaAPIKeyNameFormat, item.TenantId), apiKey);

                                    Console.WriteLine($"Adding admin user to Organization:{orgId}");
                                    await this.grafanaClient.AddUserToOrg("admin", GrafanaRoleType.Admin, apiKey);

                                    Console.WriteLine($"Adding Tenant:{item.TenantId} users to Grafana Organization:{orgId}");

                                    IdentityGatewayApiListModel users = await this.identityGatewayClient.GetAllUsersForTenant(item.TenantId);

                                    foreach (var userDetals in users.Models)
                                    {
                                        GrafanaGlobalUserRequestModel user = new GrafanaGlobalUserRequestModel(userDetals.Name, userDetals.Name, userDetals.UserId, GrafanaPassword);
                                        await this.grafanaClient.AddGlobalUser(user);

                                        await this.grafanaClient.AddUserToOrg(userDetals.UserId, GrafanaRoleType.Admin, apiKey);
                                    }

                                    string tenantIdSubstring = item.TenantId.Substring(0, 8);
                                    string mainDashboardName = $"{tenantIdSubstring}-Dashboard";
                                    string mainDashboardUid = tenantIdSubstring;

                                    string adminDashboardName = $"{tenantIdSubstring}-AdminDashboard";
                                    string adminDashboardUid = $"{tenantIdSubstring}-adm";

                                    var tenant = await this.tableStorageClient.RetrieveAsync<TenantModel>(
                                        "tenant",
                                        item.TenantId.Substring(0, 1),
                                        item.TenantId);

                                    Assembly assembly = Assembly.GetExecutingAssembly();

                                    Console.WriteLine($"Adding Azure Monitor data source to Grafana Organization:{orgId}.");
                                    StreamReader reader = new StreamReader(assembly.GetManifestResourceStream("sample-azuremonitor-datasource-template.json"));
                                    string template = await reader.ReadToEndAsync();
                                    template = string.Format(
                                        template,
                                        this.config.Global.AzureActiveDirectory.AppId,
                                        this.config.Global.AzureActiveDirectory.TenantId,
                                        this.config.Global.AzureActiveDirectory.AppSecret);
                                    await this.grafanaClient.AddDataSource(template, apiKey);

                                    Console.WriteLine($"Adding Data Explorer data source to Grafana Organization:{orgId}.");
                                    reader = new StreamReader(assembly.GetManifestResourceStream("sample-dataexplorer-datasource-template.json"));
                                    template = await reader.ReadToEndAsync();
                                    template = string.Format(
                                        template,
                                        this.config.Global.AzureActiveDirectory.AppId,
                                        this.config.Global.AzureActiveDirectory.TenantId,
                                        this.config.Global.AzureActiveDirectory.AppSecret,
                                        $"https://{this.config.Global.DataExplorer.Name}.{this.config.Global.Location}.kusto.windows.net/");
                                    await this.grafanaClient.AddDataSource(template, apiKey);

                                    Console.WriteLine($"Adding Main dashboard to Grafana Organization:{orgId}.");
                                    reader = new StreamReader(assembly.GetManifestResourceStream("grafana-main-dashboard.json"));
                                    template = await reader.ReadToEndAsync();
                                    template = string.Format(
                                        template,
                                        this.config.ExternalDependencies.GrafanaUrl,
                                        $"{adminDashboardUid}/{adminDashboardName}",
                                        this.config.Global.SubscriptionId,
                                        this.config.Global.ResourceGroup,
                                        this.config.Global.LogAnalytics.Name,
                                        $"IoT-{item.TenantId}",
                                        mainDashboardUid,
                                        mainDashboardName,
                                        orgId);
                                    await this.grafanaClient.CreateAndUpdateDashboard(template, apiKey);

                                    Console.WriteLine($"Adding Admin dashboard to Grafana Organization:{orgId}.");
                                    reader = new StreamReader(assembly.GetManifestResourceStream("grafana-admin-dashboard.json"));
                                    template = await reader.ReadToEndAsync();
                                    template = string.Format(
                                        template,
                                        this.config.ExternalDependencies.GrafanaUrl,
                                        $"{mainDashboardUid}/{mainDashboardName}",
                                        this.config.Global.SubscriptionId,
                                        this.config.Global.ResourceGroup,
                                        this.config.Global.LogAnalytics.Name,
                                        tenant.IotHubName,
                                        this.config.Global.EventHub.Name,
                                        this.config.Global.CosmosDb.AccountName,
                                        adminDashboardUid,
                                        adminDashboardName,
                                        orgId);

                                    await this.grafanaClient.CreateAndUpdateDashboard(template, apiKey);

                                    await this.appConfigurationClient.SetValueAsync(string.Format(GrafanaUrlNameFormat, item.TenantId), $"{mainDashboardUid}/{mainDashboardName}");
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }

                                break;
                            case TenantOperation.GrafanaDashboardDeletion:
                                {
                                    var orgId = this.appConfigurationClient.GetValue(string.Format(GrafanaOrgIdNameFormat, item.TenantId));

                                    bool result = await this.grafanaClient.DeleteOrganizationByUid(orgId);

                                    if (result)
                                    {
                                        await this.appConfigurationClient.DeleteKeyAsync(string.Format(GrafanaUrlNameFormat, item.TenantId));
                                        await this.appConfigurationClient.DeleteKeyAsync(string.Format(GrafanaOrgIdNameFormat, item.TenantId));
                                        await this.tableStorageClient.DeleteAsync(TableName, item);
                                    }
                                }

                                break;
                            case TenantOperation.ADXDatabaseDeletion:
                                try
                                {
                                    Console.WriteLine($"Deleting {item.Name}...");
                                    await this.azureManagementClient.KustoClusterManagementClient.DeleteDatabaseAsync(item.Name);
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }
                                catch (ResourceNotFoundException)
                                {
                                    Console.WriteLine($"Deleting Table Operation Record...");
                                }

                                break;
                            case TenantOperation.EventHubDeletion:
                                try
                                {
                                    Console.WriteLine($"Deleting {item.Name}...");
                                    await this.azureManagementClient.EventHubsManagementClient.DeleteEventHubNameSpace(item.Name);
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }
                                catch (ResourceNotFoundException)
                                {
                                    Console.WriteLine($"Deleting Table Operation Record...");
                                }

                                break;
                            case TenantOperation.BlobEventSubscriptionDeletion:
                                try
                                {
                                    Console.WriteLine($"Deleting {item.Name}...");
                                    await this.azureManagementClient.EventGridManagementClient.DeleteSystemTopicEventSubscriptionAsync(this.config.Global.BlobEventGridSystemTopic.Name, item.Name);
                                    await this.tableStorageClient.DeleteAsync(TableName, item);
                                }
                                catch (ResourceNotFoundException)
                                {
                                    Console.WriteLine($"Deleting Table Operation Record...");
                                }

                                break;
                            default:
                                break;
                        }
                    }
                    catch (Exception e)
                    {
                        Console.WriteLine(e.Message);
                    }
                }

                await Task.Delay(15000, stoppingToken);
            }
        }
    }
}