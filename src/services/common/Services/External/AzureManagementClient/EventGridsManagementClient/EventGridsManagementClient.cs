// <copyright file="EventGridsManagementClient.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Threading.Tasks;
using Microsoft.Azure.Management.ResourceManager.Fluent;
using Mmm.Iot.Common.Services.Config;

namespace Mmm.Iot.Common.Services.External.Azure
{
    public class EventGridsManagementClient : IEventGridsManagementClient
    {
        private readonly ResourceManagementClient client;
        private readonly AppConfig config;

        public EventGridsManagementClient(ResourceManagementClient client, AppConfig config)
        {
            this.client = client;
            this.config = config;
        }

        public async Task DeleteSystemTopicEventSubscriptionAsync(string systemTopicName, string eventSubscriptionName)
        {
            try
            {
                await this.client.Resources.BeginDeleteByIdAsync(
                    $"/subscriptions/{this.config.Global.SubscriptionId}/resourceGroups/{this.config.Global.ResourceGroup}/providers/Microsoft.EventGrid/systemTopics/{systemTopicName}/eventSubscriptions/{eventSubscriptionName}",
                    "2021-12-01");
            }
            catch (System.Exception ex)
            {
                throw ex;
            }
        }
    }
}