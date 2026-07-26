from fastapi import WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.services.auth_service import auth_service
from app.services.presence_service import presence_service
from app.services.whiteboard_service import whiteboard_service
from app.services.workspace_service import workspace_service
from app.websocket.connection_manager import connection_manager


async def whiteboard_socket(websocket: WebSocket, whiteboard_id: str) -> None:
    """WebSocket handler for real-time whiteboard collaboration."""
    token = websocket.query_params.get("token", "")
    user_name = ""
    user_role = "viewer"

    try:
        user_id = decode_token(token, "access")
        board = await whiteboard_service.get(whiteboard_id)
        member = await workspace_service.member(board.workspace_id, user_id)
        if not member:
            raise ValueError("Not a workspace member")
        user_role = member.role
        # Fetch user name for cursor labels
        try:
            user_obj = await auth_service.get_user(user_id)
            user_name = user_obj.name
        except Exception:
            user_name = user_id[:6]
    except Exception:
        await websocket.close(code=1008)
        return

    await connection_manager.connect(whiteboard_id, user_id, websocket, user_name, user_role)
    await presence_service.join_whiteboard(whiteboard_id, user_id)

    # Build online users list
    users_list = connection_manager.connected_users(whiteboard_id)

    # Broadcast join to others
    await connection_manager.broadcast(
        whiteboard_id,
        {
            "type": "presence",
            "action": "joined",
            "user_id": user_id,
            "user_name": user_name,
            "count": connection_manager.connected_count(whiteboard_id),
            "users": users_list,
        },
        exclude_user_id=user_id,
    )

    # Send connected event to the new user (includes lock status)
    board = await whiteboard_service.get(whiteboard_id)
    await websocket.send_json({
        "type": "presence",
        "action": "connected",
        "user_id": user_id,
        "user_name": user_name,
        "role": user_role,
        "count": connection_manager.connected_count(whiteboard_id),
        "users": users_list,
        "is_locked": board.is_locked,
    })

    try:
        while True:
            event = await websocket.receive_json()
            kind = event.get("type")

            if kind == "cursor":
                x = float(event.get("x", 0))
                y = float(event.get("y", 0))
                await presence_service.set_cursor(whiteboard_id, user_id, x, y)
                await connection_manager.broadcast(
                    whiteboard_id,
                    {
                        "type": "cursor",
                        "user_id": user_id,
                        "user_name": user_name,
                        "x": x,
                        "y": y,
                    },
                    exclude_user_id=user_id,
                )

            elif kind == "board:update" and isinstance(event.get("objects"), list):
                # Check board lock
                current_board = await whiteboard_service.get(whiteboard_id)
                if current_board.is_locked:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Board is locked. No edits are allowed.",
                    })
                    continue

                # Only editors and owners can send board updates
                if user_role not in {"owner", "editor"}:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Viewer mode: you cannot edit the board",
                    })
                    continue
                await connection_manager.broadcast(
                    whiteboard_id,
                    {
                        "type": "board:update",
                        "user_id": user_id,
                        "objects": event["objects"],
                    },
                    exclude_user_id=user_id,
                )

            elif kind == "selection:update":
                # Broadcast selection state to other users
                await connection_manager.broadcast(
                    whiteboard_id,
                    {
                        "type": "selection:update",
                        "user_id": user_id,
                        "user_name": user_name,
                        "selected_ids": event.get("selected_ids", []),
                    },
                    exclude_user_id=user_id,
                )

    except WebSocketDisconnect:
        pass
    finally:
        connection_manager.disconnect(whiteboard_id, user_id)
        await presence_service.leave_whiteboard(whiteboard_id, user_id)

        # Broadcast updated user list after disconnect
        users_list = connection_manager.connected_users(whiteboard_id)
        await connection_manager.broadcast(
            whiteboard_id,
            {
                "type": "presence",
                "action": "left",
                "user_id": user_id,
                "user_name": user_name,
                "count": connection_manager.connected_count(whiteboard_id),
                "users": users_list,
            },
        )
