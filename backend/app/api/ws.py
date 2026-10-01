@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    settings = ws.app.state.settings
    if not origin_allowed(ws):
        await ws.close(code=4403)
        return
    token = ws.cookies.get(settings.cookie_name)
    async with ws.app.state.sessionmaker() as session:
        user = await user_from_token(session, token, settings)
        if user is None:
            await ws.close(code=4401)
            return
        snapshot = await realtime.devices_payload(session, user.id)
    expires_at = (decode_session_token(token, settings) or {}).get("exp", time.time())

    pubsub = ws.app.state.redis.pubsub()
    try:
        await pubsub.subscribe(realtime.channel(user.id))
    except RedisError:
        with contextlib.suppress(Exception):
            await pubsub.aclose()
        await ws.close(code=1011)
        return
    await ws.accept()
    await ws.send_json({"type": "devices_update", "devices": snapshot})

    async def forward() -> None:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await ws.send_text(message["data"])

    async def keepalive() -> None:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            await ws.send_json({"type": "ping"})

    async def receive() -> None:
        while True:
            await ws.receive_text()

    tasks = [asyncio.create_task(c()) for c in (forward, keepalive, receive)]
    try:
        timeout = max(1, expires_at - time.time()) if expires_at else None
        await asyncio.wait(
            tasks,
            timeout=timeout,
            return_when=asyncio.FIRST_COMPLETED,
        )
    except WebSocketDisconnect:
        pass
    finally:
        # 1. Cancelar tasks
        for task in tasks:
            task.cancel()
        # 2. Aguardar cancelamento completo (não propagar exceções)
        await asyncio.gather(*tasks, return_exceptions=True)
        # 3. Fechar pubsub — cada passo em bloco próprio
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe()
        with contextlib.suppress(Exception):
            await pubsub.aclose()
        # 4. Fechar WS por último
        with contextlib.suppress(Exception):
            await ws.close(code=4401)
