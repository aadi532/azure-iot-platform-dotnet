// <copyright file="IAzureManagementClient.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Threading.Tasks;
using Mmm.Iot.Common.Services.External.EventHub;

namespace Mmm.Iot.Common.Services.External.Azure
{
    public interface IAzureManagementClient : IStatusOperation
    {
        IoTHubManagementClient IotHubManagementClient { get; }

        DpsManagementClient DpsManagmentClient { get; }

        AsaManagementClient AsaManagementClient { get; }

        KustoClusterManagementClient KustoClusterManagementClient { get; }

        EventHubsManagementClient EventHubsManagementClient { get; }

        EventGridsManagementClient EventGridManagementClient { get; }

        Task DeployTemplateAsync(string template, string resourceGroup = null, string deploymentName = null);
    }
}