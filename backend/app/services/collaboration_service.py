import hashlib, json
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException
from app.repositories.collaboration_repository import collaboration_repository as repo
from app.repositories.user_repository import user_repository
from app.services.whiteboard_service import whiteboard_service
from app.schemas.whiteboard import WhiteboardUpdate


class CollaborationService:
    async def create_version(self, board_id, user_id, message):
        board = await whiteboard_service.get(board_id)
        snapshot = board.board_data
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
        versions = await repo.versions_for(board_id)
        if versions and versions[0]['snapshot_hash'] == digest:
            return None
        value = {
            '_id': str(uuid4()),
            'whiteboard_id': board_id,
            'version_number': len(versions) + 1,
            'snapshot': snapshot,
            'snapshot_hash': digest,
            'message': message,
            'created_by': user_id,
            'created_at': datetime.now(timezone.utc),
        }
        await repo.add_version(value)
        return value

    async def restore(self, version_id, user_id):
        """Restore a version by creating a new version with the old snapshot, then updating the board."""
        value = await repo.version(version_id)
        if not value:
            raise HTTPException(404, 'Version not found')

        board_id = value['whiteboard_id']
        snapshot = value['snapshot']

        # Create a new version to preserve history (the restored snapshot becomes the latest)
        digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
        versions = await repo.versions_for(board_id)
        new_version = {
            '_id': str(uuid4()),
            'whiteboard_id': board_id,
            'version_number': len(versions) + 1,
            'snapshot': snapshot,
            'snapshot_hash': digest,
            'message': f'Restored from v{value["version_number"]}',
            'created_by': user_id,
            'created_at': datetime.now(timezone.utc),
        }
        await repo.add_version(new_version)

        # Update the actual whiteboard
        board = await whiteboard_service.get(board_id)
        return await whiteboard_service.update(board, WhiteboardUpdate(board_data=snapshot))

    async def add_comment(self, board_id, user_id, data):
        now = datetime.now(timezone.utc)
        value = {
            '_id': str(uuid4()),
            'whiteboard_id': board_id,
            'object_id': data.object_id,
            'author_id': user_id,
            'text': data.text,
            'parent_comment_id': data.parent_comment_id,
            'resolved': False,
            'created_at': now,
            'updated_at': now,
        }
        await repo.add_comment(value)
        return value

    async def notify(self, user_id, kind, title, message, metadata={}):
        value = {
            '_id': str(uuid4()),
            'user_id': user_id,
            'type': kind,
            'title': title,
            'message': message,
            'metadata': metadata,
            'read': False,
            'created_at': datetime.now(timezone.utc),
        }
        await repo.add_notification(value)
        return value

    async def enrich_version(self, version: dict) -> dict:
        """Add created_by_name to a version dict."""
        try:
            user = await user_repository.find_by_id(version['created_by'])
            version['created_by_name'] = user.name if user else 'Unknown'
        except Exception:
            version['created_by_name'] = 'Unknown'
        return version


collaboration_service = CollaborationService()
