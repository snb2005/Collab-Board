from datetime import datetime, timezone
from uuid import uuid4
from app.db.mongodb import database
class CollaborationRepository:
    versions: dict[str, dict] = {}; comments: dict[str, dict] = {}; notifications: dict[str, dict] = {}
    async def add_version(self, value):
        if database.db is not None: await database.db.versions.insert_one(value)
        else: self.versions[value['_id']] = value
    async def versions_for(self, board_id):
        if database.db is not None: return await database.db.versions.find({'whiteboard_id': board_id}).sort('version_number', -1).to_list(None)
        return sorted((v for v in self.versions.values() if v['whiteboard_id']==board_id), key=lambda x:x['version_number'], reverse=True)
    async def version(self, version_id):
        return await database.db.versions.find_one({'_id':version_id}) if database.db is not None else self.versions.get(version_id)
    async def add_comment(self, value):
        if database.db is not None: await database.db.comments.insert_one(value)
        else: self.comments[value['_id']] = value
    async def comments_for(self, board_id):
        if database.db is not None: return await database.db.comments.find({'whiteboard_id':board_id}).sort('created_at',1).to_list(None)
        return sorted((v for v in self.comments.values() if v['whiteboard_id']==board_id), key=lambda x:x['created_at'])
    async def comment(self, comment_id): return await database.db.comments.find_one({'_id':comment_id}) if database.db is not None else self.comments.get(comment_id)
    async def comment_update(self, comment_id, changes):
        changes['updated_at']=datetime.now(timezone.utc)
        if database.db is not None: await database.db.comments.update_one({'_id':comment_id},{'$set':changes}); return await self.comment(comment_id)
        self.comments[comment_id].update(changes); return self.comments[comment_id]
    async def comment_delete(self, comment_id):
        if database.db is not None: await database.db.comments.delete_many({'$or':[{'_id':comment_id},{'parent_comment_id':comment_id}]})
        else:
            for key in [k for k,v in self.comments.items() if k==comment_id or v['parent_comment_id']==comment_id]: self.comments.pop(key)
    async def add_notification(self,value):
        if database.db is not None: await database.db.notifications.insert_one(value)
        else: self.notifications[value['_id']]=value
    async def notifications_for(self,user_id):
        if database.db is not None:return await database.db.notifications.find({'user_id':user_id}).sort('created_at',-1).to_list(None)
        return sorted((v for v in self.notifications.values() if v['user_id']==user_id),key=lambda x:x['created_at'],reverse=True)
    async def notification_update(self,notification_id,changes):
        if database.db is not None: await database.db.notifications.update_one({'_id':notification_id},{'$set':changes})
        else: self.notifications[notification_id].update(changes)
    async def notification_delete(self,notification_id):
        if database.db is not None: await database.db.notifications.delete_one({'_id':notification_id})
        else:self.notifications.pop(notification_id,None)
collaboration_repository=CollaborationRepository()
