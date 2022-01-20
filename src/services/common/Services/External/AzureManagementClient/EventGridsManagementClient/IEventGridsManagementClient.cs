// <copyright file="IEventGridsManagementClient.cs" company="3M">
// Copyright (c) 3M. All rights reserved.
// </copyright>

using System.Threading.Tasks;

namespace Mmm.Iot.Common.Services.External.Azure
{
    public interface IEventGridsManagementClient
    {
        Task DeleteSystemTopicEventSubscriptionAsync(string systemTopicName, string eventSubscriptionName);
    }
}