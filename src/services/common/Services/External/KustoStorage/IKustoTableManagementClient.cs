// <copyright file="IKustoTableManagementClient.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System;
using System.Collections.Generic;
using Kusto.Data;
using Kusto.Data.Common;
using Kusto.Data.Ingestion;

namespace Mmm.Iot.Common.Services.External.KustoStorage
{
    public interface IKustoTableManagementClient
    {
        void CreateTable(string tableName, IEnumerable<Tuple<string, string>> rowFields, string databaseName);

        void CreateTableMapping(string tableMappingName, IEnumerable<ColumnMapping> mapping, string tableName, string databaseName, IngestionMappingKind ingestionMappingKind = IngestionMappingKind.Json);

        void EnableStreamingIngestionPolicyToTable(string tableName, string databaseName);

        void AlterTableRetentionPolicy(string tableName, string databaseName, TimeSpan? softDeletePeriod, DataRecoverability recoverability = DataRecoverability.Unknown);

        void AlterTablePolicy(string tableName, string databaseName, IEnumerable<DataUpdatePolicy> dataUpdatePolicies);

        void CreateOrAlterFunction(string functionName, IDictionary<string, string> parameters, string body, string databaseName);
    }
}