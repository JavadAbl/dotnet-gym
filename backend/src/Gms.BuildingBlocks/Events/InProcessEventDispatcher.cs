using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Gms.BuildingBlocks.Events;

public interface IIntegrationEvent
{
    DateTime OccurredAtUtc { get; }
}

public interface IEventHandler<in TEvent> where TEvent : IIntegrationEvent
{
    Task HandleAsync(TEvent evt, CancellationToken cancellationToken = default);
}

public interface IEventDispatcher
{
    Task PublishAsync<TEvent>(TEvent evt, CancellationToken cancellationToken = default) where TEvent : IIntegrationEvent;
}

/// <summary>In-process dispatcher. When a module is extracted to a service later, swap this implementation.</summary>
public sealed class InProcessEventDispatcher(IServiceProvider serviceProvider, ILogger<InProcessEventDispatcher> logger)
    : IEventDispatcher
{
    public async Task PublishAsync<TEvent>(TEvent evt, CancellationToken cancellationToken = default)
        where TEvent : IIntegrationEvent
    {
        var handlers = serviceProvider.GetServices<IEventHandler<TEvent>>().ToList();
        foreach (var handler in handlers)
        {
            await handler.HandleAsync(evt, cancellationToken);
        }

        logger.LogDebug("Published {EventName} to {HandlerCount} handler(s)", typeof(TEvent).Name, handlers.Count);
    }
}
