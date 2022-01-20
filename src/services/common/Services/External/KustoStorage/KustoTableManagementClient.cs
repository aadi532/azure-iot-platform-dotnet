// <copyright file="KustoTableManagementClient.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using Kusto.Data;
using Kusto.Data.Common;
using Kusto.Data.Net.Client;
using Microsoft.Extensions.Logging;
using Mmm.Iot.Common.Services.Config;
using Mmm.Iot.Common.Services.Exceptions;

namespace Mmm.Iot.Common.Services.External.KustoStorage
{
    public class KustoTableManagementClient : IKustoTableManagementClient
    {
        private readonly ILogger logger;
        private AppConfig config;
        private ICslAdminProvider client;
        private bool disposedValue = false;

        public KustoTableManagementClient(AppConfig config, ILogger<KustoTableManagementClient> logger)
        {
            this.config = config;
            this.logger = logger;
            this.client = this.GetKustoAdminClient();
        }

        public void CreateTable(string tableName, IEnumerable<Tuple<string, string>> rowFields, string databaseName)
        {
            try
            {
                var command = CslCommandGenerator.GenerateTableCreateCommand(
                                                tableName,
                                                rowFields);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void CreateTableMapping(string tableMappingName, IEnumerable<ColumnMapping> mapping, string tableName, string databaseName, Kusto.Data.Ingestion.IngestionMappingKind ingestionMappingKind = Kusto.Data.Ingestion.IngestionMappingKind.Json)
        {
            try
            {
                var command = CslCommandGenerator.GenerateTableMappingCreateCommand(
                           ingestionMappingKind,
                           tableName,
                           tableMappingName,
                           mapping);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void EnableStreamingIngestionPolicyToTable(string tableName, string databaseName)
        {
            try
            {
                var command = CslCommandGenerator.GenerateTableAlterStreamingIngestionPolicyCommand(tableName, true);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void AlterTableRetentionPolicy(string tableName, string databaseName, TimeSpan? softDeletePeriod, DataRecoverability recoverability = DataRecoverability.Unknown)
        {
            try
            {
                var command = CslCommandGenerator.GenerateTableAlterRetentionPolicyCommand(databaseName, tableName, softDeletePeriod, recoverability);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void AlterTablePolicy(string tableName, string databaseName, IEnumerable<DataUpdatePolicy> dataUpdatePolicies)
        {
            try
            {
                var command = CslCommandGenerator.GenerateTableUpdatePoliciesAlterCommand(databaseName, tableName, dataUpdatePolicies);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void CreateOrAlterFunction(string functionName, IDictionary<string, string> parameters, string body, string databaseName)
        {
            try
            {
                if (parameters == null)
                {
                    parameters = new Dictionary<string, string>();
                }

                var command = CslCommandGenerator.GenerateCreateOrAlterFunctionCommand(functionName, null, null, parameters, body);

                this.client.ExecuteControlCommand(databaseName, command);
            }
            catch (Exception e)
            {
                throw e;
            }
        }

        public void Dispose()
        {
            this.Dispose(true);
        }

        protected virtual void Dispose(bool disposing)
        {
            if (!this.disposedValue)
            {
                if (disposing)
                {
                    this.client.Dispose();
                }

                this.disposedValue = true;
            }
        }

        private ICslAdminProvider GetKustoAdminClient()
        {
            if (this.client == null)
            {
                try
                {
                    var kustoUri = $"https://{this.config.Global.DataExplorer.Name}.{this.config.Global.Location}.kusto.windows.net/";

                    var kustoConnectionStringBuilder = new KustoConnectionStringBuilder(kustoUri)
                        .WithAadApplicationKeyAuthentication(
                        applicationClientId: this.config.Global.AzureActiveDirectory.AppId,
                        applicationKey: this.config.Global.AzureActiveDirectory.AppSecret,
                        authority: this.config.Global.AzureActiveDirectory.TenantId);

                    this.client = KustoClientFactory.CreateCslAdminProvider(kustoConnectionStringBuilder);
                }
                catch (Exception e)
                {
                    var msg = "Unable to retrieve kusto with Active Directory properties";
                    throw new InvalidConfigurationException(msg, e);
                }

                if (this.client == null)
                {
                    // this.logger.LogError(new Exception(errorMessage), errorMessage);
                    throw new InvalidConfigurationException("Could not connect to kusto client");
                }
            }

            return this.client;
        }
    }
}