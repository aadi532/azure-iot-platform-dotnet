param(
    [string] $applicationCode,
    [string] $environmentCategory,
    [string] $resourceGroupName,
    [string] $servicePrincipalId, 
    [string] $servicePrincipalKey,
    [string] $storageAccountName, 
    [string] $tenantId,
    [string] $clusterName,
    [string] $subscriptionId,
    [string] $appConfigurationName,
    [string] $blobEventGridSystemTopicName
)


try {       
     
    #remove and reisntall pkmngr and install packages
    if (-not $(Get-PackageSource -Name MyNuGet -ProviderName NuGet -ErrorAction Ignore)) {
        Register-PackageSource -Name MyNuGet -Location https://www.nuget.org/api/v2 -ProviderName NuGet
    }
    Install-Module -Name Az.Kusto -Force
    Install-Module -Name AzTable -Force
    Install-Package Microsoft.Azure.Kusto.Tools -RequiredVersion 5.1.0 -Source MyNuGet -Destination . -Force

    Write-Host "############## Installed Kusto, AzTable and Kusto.Tools successfully."


    $cloudTable = (Get-AzStorageAccount -ResourceGroupName $resourceGroupName -Name $storageAccountName).Context
    $tableObject = (Get-AzStorageTable -Name "tenant" -Context $cloudTable).CloudTable
    $iotHubArray = (Get-AzTableRow -table $tableObject -CustomFilter 'IsIotHubDeployed eq true')
    $location = (Get-AzResourceGroup -Name $resourceGroupName | Select-Object location).location 
    $spKey = ConvertTo-SecureString -String $servicePrincipalKey -AsPlainText -Force

    az cloud set -n AzureCloud
    az login --service-principal -u $servicePrincipalId --password $servicePrincipalKey --tenant $tenantId --allow-no-subscriptions
    az account set --subscription $subscriptionId
    az extension add -n eventgrid


    function Update-TelemetryInfra {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $resourceGroupName,
            [string] $clusterName,
            [string] $clusterLocation,
            [string] $databaseName,
            [string] $connStr
        )

        $telemetryEventhubName = "$tenantId-telemetry"

        $isEventHubExists = Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $telemetryEventhubName -ErrorAction Ignore
        if ($null -eq $isEventHubExists) {
            Write-Host "############## Creating EventHub $telemetryEventhubName" 
            New-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $telemetryEventhubName -MessageRetentionInDays 1
        }
        else { 
            Write-Host "############## EventHub Already exists $telemetryEventhubName." 
        }
	  
        $telemetryEventHubResourceId = (Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $telemetryEventhubName).Id
        $telmetryMappingName = "'TelemetryEvents_JSON_Mapping-" + $tenantId + "'"
        $telmetryDataMappingName = $telmetryMappingName.Split("'")[1]
        $telemetryDataconnectionName = "TelemetryDataConnect-" + $tenantId.Split("-")[0]
		  
			   
        Get-AzKustoDatabase -ClusterName $clusterName -ResourceGroupName $resourceGroupName -Name $databaseName  

        #change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\TelemetryTableCreation.txt -Raw) -replace 'MAPPINGNAME', $telmetryMappingName | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\TelemetryTableCreation.txt -ErrorAction Stop
        Write-Host "############## Changed the path in the script file!"
			   
			   
        Microsoft.Azure.Kusto.Tools.5.1.0\Tools\Kusto.Cli.exe $connStr -script:".\pipelines\cd\ExistingTenantsADE\TelemetryTableCreation.txt"
        Write-Host "############## Executed the Kusto Script."

        #REVERT change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\TelemetryTableCreation.txt -Raw) -replace $telmetryMappingName, 'MAPPINGNAME' | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\TelemetryTableCreation.txt -ErrorAction Stop
        Write-Host "############## Reverted the change in the script file."


        #Data Connection
		  
        ##checking if Name exists.
        if ((Test-AzKustoDataConnectionNameAvailability -ClusterName $clusterName -DatabaseName $databaseName -ResourceGroupName $resourceGroupName -Name $telemetryDataconnectionName).NameAvailable) {
            New-AzKustoDataConnection -ResourceGroupName $resourceGroupName -ClusterName $clusterName -DatabaseName $databaseName -DataConnectionName $telemetryDataconnectionName -Location $clusterLocation -Kind "EventHub" -EventHubResourceId $telemetryEventHubResourceId -DataFormat "JSON" -ConsumerGroup '$Default' -TableName "Telemetry" -MappingRuleName $telmetryDataMappingName
            Write-Host "############## Created Data Connection."
        }
        else {
            write-host("############## There is already a Data conection with the Name $telemetryDataconnectionName.")
        }

    }

    function Update-DeviceTwinInfra {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $resourceGroupName,
            [string] $clusterName,
            [string] $clusterLocation,
            [string] $databaseName,
            [string] $connStr
        )

        $deviceTwinEventhubName = "$tenantId-devicetwin"

        $isDeviceTwinEventHubExists = Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceTwinEventhubName -ErrorAction Ignore
        if ($null -eq $isDeviceTwinEventHubExists) {
            Write-Host "############## Creating EventHub $deviceTwinEventhubName" 
            New-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceTwinEventhubName -MessageRetentionInDays 1
        }
        else { 
            Write-Host "############## EventHub Already exists $deviceTwinEventhubName." 
        }
		  
        $deviceTwinEventHubResourceId = (Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceTwinEventhubName).Id
        $deviceTwinMappingName = "'DeviceTwinEvents_JSON_Mapping-" + $tenantId + "'"
        $deviceTwinDataMappingName = $deviceTwinMappingName.Split("'")[1]
        $deviceTwinDataconnectionName = "DeviceTwinDataConnect-" + $tenantId.Split("-")[0]
		  
			   
        Get-AzKustoDatabase -ClusterName $clusterName -ResourceGroupName $resourceGroupName -Name $databaseName  

        #change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceTwinTableCreation.txt -Raw) -replace 'MAPPINGNAME', $deviceTwinMappingName | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceTwinTableCreation.txt -ErrorAction Stop
        Write-Host "############## Changed the path in the script file!"
			   
			   
        Microsoft.Azure.Kusto.Tools.5.1.0\Tools\Kusto.Cli.exe $connStr -script:".\pipelines\cd\ExistingTenantsADE\DeviceTwinTableCreation.txt"
        Write-Host "############## Executed the Kusto Script."

        #REVERT change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceTwinTableCreation.txt -Raw) -replace $deviceTwinMappingName, 'MAPPINGNAME' | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceTwinTableCreation.txt -ErrorAction Stop
        Write-Host "############## Reverted the change in the script file."


        #Data Connection
		  
        ##checking if Name exists.
        if ((Test-AzKustoDataConnectionNameAvailability -ClusterName $clusterName -DatabaseName $databaseName -ResourceGroupName $resourceGroupName -Name $deviceTwinDataconnectionName).NameAvailable) {
            New-AzKustoDataConnection -ResourceGroupName $resourceGroupName -ClusterName $clusterName -DatabaseName $databaseName -DataConnectionName $deviceTwinDataconnectionName -Location $clusterLocation -Kind "EventHub" -EventHubResourceId $deviceTwinEventHubResourceId -DataFormat "JSON" -ConsumerGroup '$Default' -TableName "DeviceTwin" -MappingRuleName $deviceTwinDataMappingName
            Write-Host "############## Created Data Connection."
        }
        else {
            write-host("############## There is already a Data conection with the Name $deviceTwinDataconnectionName.")
        }

    }

    function Get-SAJobQuery {
        $saJobQuery = @"
                    {
                        "name":"MyTransformation",
                        "type":"Microsoft.StreamAnalytics/streamingjobs/transformations",
                        "properties":{
                            "streamingUnits":1,
                            "script":null,
                            "query":"WITH MessageData AS
                                    (
                                        SELECT
                                            *,
                                            GetMetadataPropertyValue(DeviceTelemetry, '[User].[batchedTelemetry]') AS __isbatched,
                                            DeviceTelemetry.IotHub.ConnectionDeviceId AS __deviceId,
                                            udf.getTelemetryDataArrayIfExists(DeviceTelemetry, GetMetadataPropertyValue(DeviceTelemetry, '[User].[batchedTelemetry]')) AS __dataArray
                                        FROM
                                            DeviceTelemetry PARTITION BY PartitionId TIMESTAMP BY DeviceTelemetry.EventEnqueuedUtcTime
                                    ),
                                    ProcessedTelemetry AS
                                    (
                                        SELECT
                                            *, -- This value is selected 'AS Message' When using ProcessedTelemetry later in the query
                                            Message.PartitionId,
                                            Message.__isBatched,
                                            Message.__deviceId,
                                            DataPoints.ArrayValue AS __batchedDataPoints,
                                            udf.getReceivedTime(Message, DataPoints.ArrayValue, Message.__isBatched) AS __receivedTime
                                        FROM
                                            MessageData Message
                                            CROSS APPLY GetArrayElements(Message.__dataArray) AS DataPoints
                                    ),
                                    TelemetryAndRules AS
                                    (
                                        SELECT
                                            T.__deviceId,
                                            T.__receivedTime,
                                            T.PartitionId,
                                            R.Id as __ruleid,
                                            R.AggregationWindow,
                                            Fields.ArrayValue as MeasurementName,
                                            CASE 
                                                WHEN T.__isBatched = 'true' THEN BatchedDataPoints.ArrayValue
                                                ELSE GetRecordPropertyValue(T.Message, Fields.ArrayValue)
                                            END AS MeasurementValue
                                        FROM
                                            ProcessedTelemetry T  -- T.Message represents the raw message selected from the DeviceTelemetry input
                                            JOIN DeviceGroups G ON T.__deviceid = G.DeviceId
                                            JOIN Rules R ON R.GroupId = G.GroupId
                                            CROSS APPLY GetArrayElements(R.Fields) AS Fields
                                            CROSS APPLY GetArrayElements(T.__batchedDataPoints) AS BatchedDataPoints
                                        WHERE
                                            T.__isBatched != 'true'
                                            OR T.__isBatched is null
                                            OR BatchedDataPoints.ArrayIndex = udf.getBatchedChannelIndex(T.Message, Fields.ArrayValue)
                                    ),
                                    AggregateMultipleWindows AS (
                                        SELECT
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            AVG(TR.MeasurementValue),
                                            MAX(TR.MeasurementValue),
                                            MIN(TR.MeasurementValue),
                                            COUNT(TR.MeasurementValue),
                                            MAX(DATEDIFF(millisecond, '1970-01-01T00:00:00Z', TR.__receivedtime)) as __lastReceivedTime
                                        FROM
                                            TelemetryAndRules TR PARTITION BY PartitionId
                                        WHERE
                                            TR.AggregationWindow = 'tumblingwindow1minutes'
                                        GROUP BY
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            TumblingWindow(minute, 1)
                
                                        UNION
                
                                        SELECT
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            AVG(TR.MeasurementValue),
                                            MAX(TR.MeasurementValue),
                                            MIN(TR.MeasurementValue),
                                            COUNT(TR.MeasurementValue),
                                            MAX(DATEDIFF(millisecond, '1970-01-01T00:00:00Z', TR.__receivedtime)) as __lastReceivedTime
                                        FROM
                                            TelemetryAndRules TR PARTITION BY PartitionId
                                        WHERE
                                            TR.AggregationWindow = 'tumblingwindow5minutes'
                                        GROUP BY
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            TumblingWindow(minute, 5)
                
                                        UNION
                
                                        SELECT
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            AVG(TR.MeasurementValue),
                                            MAX(TR.MeasurementValue),
                                            MIN(TR.MeasurementValue),
                                            COUNT(TR.MeasurementValue),
                                            MAX(DATEDIFF(millisecond, '1970-01-01T00:00:00Z', TR.__receivedtime)) as __lastReceivedTime
                                        FROM
                                            TelemetryAndRules TR PARTITION BY PartitionId
                                        WHERE
                                            TR.AggregationWindow = 'tumblingwindow10minutes'
                                        GROUP BY
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.MeasurementName,
                                            TumblingWindow(minute, 10)
                                    ),
                                    GroupAggregatedMeasurements AS (
                                        SELECT
                                            AM.__deviceid,
                                            AM.__ruleid,
                                            AM.PartitionId,
                                            AM.__lastReceivedTime,
                                            Collect() AS Measurements
                                        FROM
                                            AggregateMultipleWindows AM PARTITION BY PartitionId
                                        GROUP BY
                                            AM.__deviceid,
                                            AM.__ruleid,
                                            AM.PartitionId,
                                            AM.__lastReceivedTime,
                                            System.Timestamp
                                    ),
                                    FlatAggregatedMeasurements AS (
                                        SELECT
                                            GA.__deviceid,
                                            GA.__ruleid,
                                            GA.__lastReceivedTime,
                                            udf.flattenMeasurements(GA) AS __aggregates
                                        FROM
                                            GroupAggregatedMeasurements GA PARTITION BY PartitionId
                                    ),
                                    CombineAggregatedMeasurementsAndRules AS (
                                        SELECT
                                            FA.__deviceid,
                                            FA.__ruleid,
                                            FA.__aggregates,
                                            FA.__lastReceivedTime,
                                            R.Description as __description,
                                            R.Severity as __severity,
                                            R.Actions as __actions,
                                            R.__rulefilterjs as __rulefilterjs
                                        FROM
                                            FlatAggregatedMeasurements FA PARTITION BY PartitionId
                                            JOIN Rules R ON FA.__ruleid = R.Id
                                    ),
                                    ApplyAggregatedRuleFilters AS
                                    (
                                        SELECT
                                            CMR.*
                                        FROM
                                            CombineAggregatedMeasurementsAndRules CMR PARTITION BY PartitionId
                                        WHERE TRY_CAST(udf.applyRuleFilter(CMR) AS bigint) = 1
                                    ),
                                    GroupInstantMeasurements AS (
                                        SELECT
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.__receivedTime,
                                            Collect() AS Measurements
                                        FROM
                                            TelemetryAndRules TR PARTITION BY PartitionId
                                        WHERE
                                            TR.AggregationWindow = 'instant'
                                        GROUP BY
                                            TR.__deviceid,
                                            TR.__ruleid,
                                            TR.PartitionId,
                                            TR.__receivedTime,
                                            System.Timestamp
                                    ),
                                    FlatInstantMeasurements AS (
                                        SELECT
                                            GI.__deviceid,
                                            GI.__ruleid,
                                            GI.__receivedTime,
                                            udf.flattenMeasurements(GI) AS __aggregates
                                        FROM
                                            GroupInstantMeasurements GI PARTITION BY PartitionId
                                    ),
                                    CombineInstantMeasurementsAndRules as
                                    (
                                        SELECT
                                            FI.__deviceid,
                                            FI.__ruleid,
                                            FI.__receivedtime,
                                            FI.__aggregates,
                                            R.Description as __description,
                                            R.Severity as __severity,
                                            R.Actions as __actions,
                                            R.__rulefilterjs as __rulefilterjs
                                        FROM
                                            FlatInstantMeasurements FI PARTITION BY PartitionId
                                            JOIN Rules R ON FI.__ruleid = R.Id
                                    ),
                                    ApplyInstantRuleFilters as
                                    (
                                        SELECT
                                            CI.*
                                        FROM
                                            CombineInstantMeasurementsAndRules CI PARTITION BY PartitionId
                                        WHERE TRY_CAST(udf.applyRuleFilter(CI) AS bigint) = 1
                                    ),
                                    CombineAlarms as
                                    (
                                        SELECT
                                            1 as _schemaVersion,
                                            'alarm' as _schema,
                                            'open' as status,
                                            '1Rule-1Device-NMessage' as logic,
                                            DATEDIFF(millisecond, '1970-01-01T00:00:00Z', System.Timestamp) as created,
                                            DATEDIFF(millisecond, '1970-01-01T00:00:00Z', System.Timestamp) as modified,
                                            AA.__description as ruleDescription,
                                            AA.__severity as ruleSeverity,
                                            AA.__actions as ruleActions,
                                            AA.__ruleid as ruleId,
                                            AA.__deviceId as deviceId,
                                            AA.__aggregates,
                                            AA.__lastReceivedTime as deviceMsgReceived
                                        FROM
                                            ApplyAggregatedRuleFilters AA PARTITION BY PartitionId
                
                                        UNION
                
                                        SELECT
                                            1 as _schemaVersion,
                                            'alarm' as _schema,
                                            'open' as status,
                                            '1Rule-1Device-NMessage' as logic,
                                            DATEDIFF(millisecond, '1970-01-01T00:00:00Z', System.Timestamp) as created,
                                            DATEDIFF(millisecond, '1970-01-01T00:00:00Z', System.Timestamp) as modified,
                                            AI.__description as ruleDescription,
                                            AI.__severity as ruleSeverity,
                                            AI.__actions as ruleActions,
                                            AI.__ruleid as ruleId,
                                            AI.__deviceId as deviceId,
                                            AI.__aggregates,
                                            DATEDIFF(millisecond, '1970-01-01T00:00:00Z', AI.__receivedTime) as deviceMsgReceived
                                        FROM
                                            ApplyInstantRuleFilters AI PARTITION BY PartitionId
                                    )
                

                                    SELECT
                                        CA._schemaVersion,
                                        CA._schema,
                                        CA.status,
                                        CA.logic,
                                        CA.created,
                                        CA.modified,
                                        CA.ruleDescription,
                                        CA.ruleSeverity,
                                        CA.ruleId,
                                        CA.deviceId,
                                        CA.deviceMsgReceived
                                    INTO
                                        Alerts
                                    FROM
                                        CombineAlarms CA PARTITION BY PartitionId
                
                                    SELECT
                                        CA.created,
                                        CA.modified,
                                        CA.ruleDescription,
                                        CA.ruleSeverity,
                                        CA.ruleId,
                                        CA.ruleActions,
                                        CA.deviceId,
                                        CA.deviceMsgReceived
                                    INTO
                                        Actions
                                    FROM
                                        CombineAlarms CA PARTITION BY __partitionid
                                    WHERE
                                        CA.ruleActions IS NOT NULL"
                        }
                    }
"@

        Write-Output ($saJobQuery | ConvertFrom-Json).properties.query

    }

    function Get-SAJobOutput {
        param(
            [string] $alertsEventhubName,
            [string] $eventhubNamespace,
            [string] $eventhubSharedAccessPolicyKey
        )
        $saJobOutputDefinition = @"
{
    "name": "Alerts",
    "type": "Microsoft.StreamAnalytics/streamingjobs/outputs",
    "properties": {
        "datasource": {
            "type": "Microsoft.ServiceBus/EventHub",
             "properties": {
                "eventHubName": "$($alertsEventhubName)",
                "serviceBusNamespace": "$($eventhubNamespace)",
                "sharedAccessPolicyName": "RootManageSharedAccessKey",  
                "sharedAccessPolicyKey": "$($eventhubSharedAccessPolicyKey)"  
                }
             },
             "serialization": {
             "type": "Json",
             "properties": {
             "encoding": "UTF8",
             "format": "LineSeparated"
             }
         }
     }
}
"@

        $outputPSObj = $saJobOutputDefinition | ConvertFrom-Json
        Write-Output $outputPSObj | ConvertTo-Json -Depth 32

    }

    function Update-DeviceGroupInfra {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $resourceGroupName,
            [string] $clusterName,
            [string] $clusterLocation,
            [string] $databaseName,
            [string] $connStr
        )

        $deviceGroupEventhubName = "$tenantId-devicegroup"

        $isDeviceGroupEventHubExists = Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceGroupEventhubName -ErrorAction Ignore
        if ($null -eq $isDeviceGroupEventHubExists) {
            Write-Host "############## Creating EventHub $deviceGroupEventhubName" 
            New-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceGroupEventhubName -MessageRetentionInDays 1
        }
        else { 
            Write-Host "############## EventHub Already exists $deviceGroupEventhubName." 
        }


        $deviceGroupEventHubResourceId = (Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceGroupEventhubName).Id
        $deviceGroupMappingName = "'DeviceGroup_JSON_Mapping-" + $tenantId + "'"
        $deviceGroupDataMappingName = $deviceGroupMappingName.Split("'")[1]
        $deviceGroupDataconnectionName = "DeviceGroupDataConnect-" + $tenantId.Split("-")[0]
		  
			   
        Get-AzKustoDatabase -ClusterName $clusterName -ResourceGroupName $resourceGroupName -Name $databaseName  

        #change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceGroupTableCreation.txt -Raw) -replace 'MAPPINGNAME', $deviceGroupMappingName | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceGroupTableCreation.txt -ErrorAction Stop
        Write-Host "############## Changed the path in the script file!"
			   
			   
        Microsoft.Azure.Kusto.Tools.5.1.0\Tools\Kusto.Cli.exe $connStr -script:".\pipelines\cd\ExistingTenantsADE\DeviceGroupTableCreation.txt"
        Write-Host "############## Executed the Kusto Script."

        #REVERT change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceGroupTableCreation.txt -Raw) -replace $deviceGroupMappingName, 'MAPPINGNAME' | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceGroupTableCreation.txt -ErrorAction Stop
        Write-Host "############## Reverted the change in the script file."


        #Data Connection
		  
        ##checking if Name exists.
        if ((Test-AzKustoDataConnectionNameAvailability -ClusterName $clusterName -DatabaseName $databaseName -ResourceGroupName $resourceGroupName -Name $deviceGroupDataconnectionName).NameAvailable) {
            New-AzKustoDataConnection -ResourceGroupName $resourceGroupName -ClusterName $clusterName -DatabaseName $databaseName -DataConnectionName $deviceGroupDataconnectionName -Location $clusterLocation -Kind "EventHub" -EventHubResourceId $deviceGroupEventHubResourceId -DataFormat "JSON" -ConsumerGroup '$Default' -TableName "DeviceGroup" -MappingRuleName $deviceGroupDataMappingName
            Write-Host "############## Created Data Connection."
        }
        else {
            write-host("############## There is already a Data conection with the Name $deviceGroupDataconnectionName.")
        }

    }

    function Update-AlertsInfra {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $resourceGroupName,
            [string] $clusterName,
            [string] $clusterLocation,
            [string] $databaseName,
            [string] $connStr
        )
  
  
        $alertsEventhubName = "$tenantId-Alerts"

        $isAlertsEventHubExists = Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $alertsEventhubName -ErrorAction Ignore
        if ($null -eq $isAlertsEventHubExists) {
            Write-Host "############## Creating EventHub $alertsEventhubName" 
            New-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $alertsEventhubName -MessageRetentionInDays 1
        }
        else { 
            Write-Host "############## EventHub Already exists $alertsEventhubName." 
        }
		  
        $alertsEventHubResourceId = (Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $alertsEventhubName).Id
        $alertsMappingName = "'RawAlertsMapping-" + $tenantId + "'"
        $alertsDataMappingName = $alertsMappingName.Split("'")[1]
        $alertsDataconnectionName = "AlertsDataConnect-" + $tenantId.Split("-")[0]
			     
        Get-AzKustoDatabase -ClusterName $clusterName -ResourceGroupName $resourceGroupName -Name $databaseName  

        #change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\AlertsTableCreation.txt -Raw) -replace 'MAPPINGNAME', $alertsMappingName | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\AlertsTableCreation.txt -ErrorAction Stop
        Write-Host "############## Changed the path in the script file!"
			   
        Microsoft.Azure.Kusto.Tools.5.1.0\Tools\Kusto.Cli.exe $connStr -script:".\pipelines\cd\ExistingTenantsADE\AlertsTableCreation.txt"
        Write-Host "############## Executed the Kusto Script."

        #REVERT change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\AlertsTableCreation.txt -Raw) -replace $alertsMappingName, 'MAPPINGNAME' | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\AlertsTableCreation.txt -ErrorAction Stop
        Write-Host "############## Reverted the change in the script file."
			   
        ##checking if Name exists.
        if ((Test-AzKustoDataConnectionNameAvailability -ClusterName $clusterName -DatabaseName $databaseName -ResourceGroupName $resourceGroupName -Name $alertsDataconnectionName).NameAvailable) {
            New-AzKustoDataConnection -ResourceGroupName $resourceGroupName -ClusterName $clusterName -DatabaseName $databaseName -DataConnectionName $alertsDataconnectionName -Location $clusterLocation -Kind "EventHub" -EventHubResourceId $alertsEventHubResourceId -DataFormat "JSON" -ConsumerGroup '$Default' -TableName "RawAlerts" -MappingRuleName $alertsDataMappingName
            Write-Host "############## Created Data Connection."
        }
        else {
            write-host("############## There is already a Data conection with the Name $alertsDataconnectionName.")
        }
    }
	
    function Update-SAJobQueryForTenant {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $eventhubSharedAccessPolicyKey,
            [string] $resourceGroupName,
            [string] $saJobName
        )

  
        $alertsEventhubName = "$tenantId-Alerts"

        # get the current path
        $currPath = (Get-Item -Path ".\").FullName

        try {

            $jsonData = Get-SAJobOutput -alertsEventhubName $alertsEventhubName `
                -eventhubNamespace $eventhubNamespace `
                -eventhubSharedAccessPolicyKey $eventhubSharedAccessPolicyKey
            $saJobOutputFileName = "Alerts.json" 
            $saJobOutputFilePath = Join-Path $currPath $saJobOutputFileName
            $jsonData | Out-File $saJobOutputFilePath
            $query = Get-SAJobQuery

            try {
                Stop-AzStreamAnalyticsJob -Name $saJobName -ResourceGroupName $resourceGroupName

                Write-Output "SAJob is stoped"
            }
            catch {
                Write-Host("An Error occured.")
                Write-Host($_)
            }

            New-AzStreamAnalyticsOutput -ResourceGroupName $resourceGroupName `
                -JobName $saJobName `
                -File $saJobOutputFilePath `
                -Name "Alerts"

            try {
                Update-AzStreamAnalyticsTransformation -ResourceGroupName $resourceGroupName `
                    -JobName $saJobName `
                    -Query $query `
                    -Name "SAQuery"

                Write-Output "Query updated successfully for SAQuery Query"
            }
            catch {
                Write-Host("An Error occured.")
                Write-Host($_)
            }

            try {
                Update-AzStreamAnalyticsTransformation -ResourceGroupName $resourceGroupName `
                    -JobName $saJobName `
                    -Query $query `
                    -Name "MyTransformation"

                Write-Output "Query updated successfully for MyTransformation Query"
            }
            catch {
                Write-Host("An Error occured.")
                Write-Host($_)
            }

            Start-AzStreamAnalyticsJob -Name $saJobName -ResourceGroupName $resourceGroupName
    
            Write-Output "Started Job successfully."
            
        }
        catch {
            Write-Host("An Error occured.")
            Write-Host($_)
        }
    }

    function Update-DeviceLogInfra {
        param(
            [string] $tenantId,
            [string] $eventhubNamespace,
            [string] $resourceGroupName,
            [string] $clusterName,
            [string] $clusterLocation,
            [string] $databaseName,
            [string] $connStr,
            [string] $blobEventGridSystemTopicName,
            [string] $storageAccountName
        )
  
  
        $deviceLogEventhubName = "$tenantId-devicelog"

        $isDeviceLogEventHubExists = Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceLogEventhubName -ErrorAction Ignore
        if ($null -eq $isDeviceLogEventHubExists) {
            Write-Host "############## Creating EventHub $deviceLogEventhubName" 
            New-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceLogEventhubName -MessageRetentionInDays 1
        }
        else { 
            Write-Host "############## EventHub Already exists $deviceLogEventhubName." 
        }
		  
        $deviceLogEventHubResourceId = (Get-AzEventHub -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -EventHubName $deviceLogEventhubName).Id
        $deviceLogMappingName = "'DevicelogEvents_CSV_Mapping-" + $tenantId + "'"
        $deviceLogDataMappingName = $deviceLogMappingName.Split("'")[1]
        $deviceLogDataconnectionName = "DeviceLogDataConnect-" + $tenantId.Split("-")[0]

        # Event Grid Subscriptions string constants
        $deviceLogEventSubscriptionName = "$tenantId-eventsub"
        $subjectBeginsWith = "/blobServices/default/containers/$tenantId-iot-file-upload"

        $isDeviceLogEventSubExists = az eventgrid system-topic event-subscription show --name $deviceLogEventSubscriptionName -g $resourceGroupName --system-topic-name $blobEventGridSystemTopicName 

        if ($null -eq $isDeviceLogEventSubExists) {
            Write-Host "############## Creating Event Grid Event Subscription $deviceLogEventSubscriptionName" 
            az eventgrid system-topic event-subscription create --name $deviceLogEventSubscriptionName `
                -g $resourceGroupName `
                --system-topic-name $blobEventGridSystemTopicName `
                --endpoint $deviceLogEventHubResourceId `
                --endpoint-type eventhub `
                --event-delivery-schema eventgridschema `
                --subject-begins-with $subjectBeginsWith `
                --subject-ends-with .csv `
                --advanced-filter subject StringContains /log/ `
                --included-event-types Microsoft.Storage.BlobCreated
        }
        else { 
            Write-Host "############## Event Grid Event Subscription Already exists $deviceLogEventSubscriptionName." 
        }


        Get-AzKustoDatabase -ClusterName $clusterName -ResourceGroupName $resourceGroupName -Name $databaseName  

        #change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceLogTableCreation.txt -Raw) -replace 'MAPPINGNAME', $deviceLogMappingName | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceLogTableCreation.txt -ErrorAction Stop
        Write-Host "############## Changed the path in the script file!"
			   
        Microsoft.Azure.Kusto.Tools.5.1.0\Tools\Kusto.Cli.exe $connStr -script:".\pipelines\cd\ExistingTenantsADE\DeviceLogTableCreation.txt"
        Write-Host "############## Executed the Kusto Script."

        #REVERT change the names in the script file for mapping Name
        (Get-Content -path .\pipelines\cd\ExistingTenantsADE\DeviceLogTableCreation.txt -Raw) -replace $deviceLogMappingName, 'MAPPINGNAME' | Set-Content -Path .\pipelines\cd\ExistingTenantsADE\DeviceLogTableCreation.txt -ErrorAction Stop
        Write-Host "############## Reverted the change in the script file."
			   
        ##checking if Name exists.
        if ((Test-AzKustoDataConnectionNameAvailability -ClusterName $clusterName -DatabaseName $databaseName -ResourceGroupName $resourceGroupName -Name $deviceLogDataconnectionName).NameAvailable) {
            $storageAccountResourceId = (Get-AzStorageAccount -ResourceGroupName $resourceGroupName -Name $storageAccountName).Id
            New-AzKustoDataConnection -ResourceGroupName $resourceGroupName -ClusterName $clusterName -DatabaseName $databaseName -DataConnectionName $deviceLogDataconnectionName -Location $clusterLocation -Kind "EventGrid" -EventHubResourceId $deviceLogEventHubResourceId -StorageAccountResourceId $storageAccountResourceId  -DataFormat "CSV" -ConsumerGroup '$Default' -TableName "DeviceLog" -MappingRuleName $deviceLogDataMappingName
            Write-Host "############## Created Data Connection."
        }
        else {
            write-host("############## There is already a Data conection with the Name $deviceLogDataconnectionName.")
        }
    }


    Foreach ($iotHub in $iotHubArray) {
        $iotTenantId = $iotHub.TenantId
        $eventhubNamespace = "eventhub-" + $iotTenantId.SubString(0, 8)
        $databaseName = "IoT-" + $iotHub.TenantId
		  
        if ((Test-AzEventHubName -Namespace $eventhubNamespace).NameAvailable) {
            New-AzEventHubNamespace -ResourceGroupName $resourceGroupName -Name $eventhubNamespace -Location $location 
            Write-Host "############## Created EventHub NameSpace : $eventhubNamespace."                   
        }
        else {
            Write-Host "############## EventHub NameSpace Already Exists $eventhubNamespace." 
        }
		  
        #Place the EventHub Namespace primary connectionstting => appConfiguration
        $connectionString = Get-AzEventHubKey -ResourceGroupName $resourceGroupName -NamespaceName $eventhubNamespace -AuthorizationRuleName RootManageSharedAccessKey
        az appconfig kv set --name $appConfigurationName --key ("tenant:" + $iotTenantId + ":eventHubConn") --value $connectionString.PrimaryConnectionString  --yes
        az appconfig kv set --name $appConfigurationName --key ("tenant:" + $iotTenantId + ":eventHubPrimaryKey") --value $connectionString.PrimaryKey  --yes
        
        Write-Host "############## Added Keys to Azure AppConfiguration"   

        $eventhubSharedAccessPolicyKey = $connectionString.PrimaryKey

        
        #$IotHubResourceId = (Get-AzIotHub -ResourceGroupName $resourceGroupName -Name $iotHub.IotHubName).Id
        $clusterURI = (Get-AzKustoCluster -Name $clusterName -ResourceGroupName $resourceGroupName).Uri          
        $clusterLocation = (Get-AzKustoCluster -Name $clusterName -ResourceGroupName $resourceGroupName).Location
        Write-Host $clusterLocation

        ##checking if Name exists.
        if ((Test-AzKustoDatabaseNameAvailability -ResourceGroupName $resourceGroupName -ClusterName $clusterName -Name $databaseName -Type Microsoft.Kusto/Clusters/Databases).NameAvailable) {
            New-AzKustoDatabase -ResourceGroupName $resourceGroupName -ClusterName $clusterName -Name $databaseName -HotCachePeriod 0:00:00:00 -Kind ReadWrite -Location $clusterLocation
            Write-Host "############## Created DataBase: $databaseName."		   
        }
        else {
            write-host("############## There is already a Database with the Name $databaseName.")
        }

        $connStr = "Data Source=" + $clusterURI + ";Initial Catalog=" + $databaseName + ";Application Client Id=" + $servicePrincipalId + ";Application Key=" + $servicePrincipalKey + ";AAD Federated Security=True;dSTS Federated Security=False;Authority Id=" + $tenantId
			   
        Update-TelemetryInfra -tenantId $iotTenantId `
            -eventhubNamespace $eventhubNamespace `
            -resourceGroupName $resourceGroupName `
            -clusterName $clusterName `
            -clusterLocation $clusterLocation `
            -databaseName $databaseName `
            -connStr $connStr
        
        Update-DeviceTwinInfra -tenantId $iotTenantId `
            -eventhubNamespace $eventhubNamespace `
            -resourceGroupName $resourceGroupName `
            -clusterName $clusterName `
            -clusterLocation $clusterLocation `
            -databaseName $databaseName `
            -connStr $connStr
        
        Update-DeviceGroupInfra -tenantId $iotTenantId `
            -eventhubNamespace $eventhubNamespace `
            -resourceGroupName $resourceGroupName `
            -clusterName $clusterName `
            -clusterLocation $clusterLocation `
            -databaseName $databaseName `
            -connStr $connStr
			
        Update-AlertsInfra -tenantId $iotTenantId `
            -eventhubNamespace $eventhubNamespace `
            -resourceGroupName $resourceGroupName `
            -clusterName $clusterName `
            -clusterLocation $clusterLocation `
            -databaseName $databaseName `
            -connStr $connStr
		  
        if ($iotHub.SAJobName) {
            Update-SAJobQueryForTenant -tenantId $iotTenantId `
                -saJobName $iotHub.SAJobName `
                -eventhubNamespace $eventhubNamespace `
                -eventhubSharedAccessPolicyKey $eventhubSharedAccessPolicyKey `
                -resourceGroupName $resourceGroupName
        }

        Update-DeviceLogInfra -tenantId $iotTenantId `
            -eventhubNamespace $eventhubNamespace `
            -resourceGroupName $resourceGroupName `
            -clusterName $clusterName `
            -clusterLocation $clusterLocation `
            -databaseName $databaseName `
            -connStr $connStr `
            -blobEventGridSystemTopicName $blobEventGridSystemTopicName `
            -storageAccountName $storageAccountName
		
        az appconfig kv set --name $appConfigurationName --key "tenant:refreshappconfig" --value $iotTenantId  --yes
    }
}
catch {
    Write-Host("An Error occured.")
    Write-Host($_)
}