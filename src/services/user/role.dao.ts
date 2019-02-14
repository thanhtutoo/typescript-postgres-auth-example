import { getConnection, Repository } from "typeorm";
import { ActivityType, event } from "../../utils/activity.helper";
import logger from "../../config/logger";
import Dao from "../../interfaces/dao.interface";
import {
  Activity,
  ActivityObject,
  Actor,
  ActorType } from "../../interfaces/activitystream.interface";
import SearchResult from "../../interfaces/searchresult.interface";
import RecordNotFoundException from "../../exceptions/RecordNotFoundException";
import RecordsNotFoundException from "../../exceptions/RecordsNotFoundException";
import UserNotAuthorizedException from "../../exceptions/UserNotAuthorizedException";
import { AuthPermission, getPermission } from "../../utils/authorization.helper";

import { User } from "./user.entity";
import { Role } from "./role.entity";
import { Permission } from "./permission.entity";
import CreateRoleDto from "./role.dto";

/**
 * Handles CRUD operations on Role data in database
 * Factoring to this class allows other (i.e. GraphQL to reuse this code in resolvers)
 */
class RoleDao implements Dao {
  private resource: string = "role"; // matches defined role role "resource"
  private rolePermissionResource: string = "rolepermission";

  constructor() {
    // nothing
  }

  public getAll = async (user: User, params?: {[key: string]: any}):
            Promise<SearchResult> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const records = await roleRepository.find({ relations: ["permissions"] });

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.READ;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!records) {
        throw new RecordsNotFoundException(this.resource);
      } else {
        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: null,
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        return {
          data: permission.filter(records),
          length: records.length,
          total: records.length,
        };
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public getOne = async (user: User, id: string):
            Promise<Role | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const record = await roleRepository.findOne(id, { relations: ["permissions"] });

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.READ;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!record) {
        throw new RecordNotFoundException(id);
      } else {
        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id: record.id, type: this.resource},
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        return permission.filter(record);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public save = async (user: User, data: any):
            Promise<Role | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const newRecord: CreateRoleDto = data;

    const isOwnerOrMember: boolean = false;
    const action: string = data.id ? ActivityType.UPDATE : ActivityType.CREATE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      const filteredData: Role = permission.filter(newRecord);
      const savedData: Role = await roleRepository.save(filteredData);

      // log event to central handler
      const ended: number = Date.now();
      event.emit(action, {
        actor: {id: user.id, type: ActorType.Person},
        object: {...savedData, type: this.resource},
        resource: this.resource,
        timestamp: ended,
        took: ended - started,
        type: action,
      });

      logger.info(`Saved ${this.resource} with ID ${filteredData.id} in the database`);
      return filteredData;
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public remove = async (user: User, id: string):
            Promise<boolean | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const recordToRemove = await roleRepository.findOne(id);

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.DELETE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (recordToRemove) {
        await roleRepository.remove(recordToRemove);

        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id, type: "role"},
          resource: this.resource,
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        logger.info(`Removed ${this.resource} with ID ${id} from the database`);
        return true;
      } else {
        throw new RecordNotFoundException(id);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public getPermissions = async (user: User, id: string):
            Promise<User | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const record = await roleRepository.findOne(id, { relations: ["permissions"] });

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.READ;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.rolePermissionResource);

    if (permission.granted) {
      if (!record) {
        throw new RecordNotFoundException(id);
      } else {
        // log event to central handler
        const ended: number = Date.now();
        event.emit(action, {
          actor: {id: user.id, type: ActorType.Person},
          object: null,
          resource: this.rolePermissionResource,
          target: {id, type: this.resource},
          timestamp: ended,
          took: ended - started,
          type: action,
        });

        return permission.filter(record.permissions);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.rolePermissionResource);
    }
  }

  public addPermission = async (user: User, id: string, data: any):
            Promise<Role | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);
    const newRecord: Permission = data;

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.CREATE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.rolePermissionResource);

    if (permission.granted) {
      const recordToUpdate = await roleRepository.findOne(id, { relations: ["permissions"] });

      if (recordToUpdate) {
        recordToUpdate.permissions.push(newRecord);

        const filteredData: Role = permission.filter(recordToUpdate);
        await roleRepository.save(recordToUpdate);

        // log event to central handler
        const ended: number = Date.now();
        event.emit(ActivityType.ADD, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id: recordToUpdate.id, type: "permission"},
          resource: this.rolePermissionResource,
          target: {id, type: this.resource},
          timestamp: ended,
          took: ended - started,
          type: ActivityType.ADD,
        });

        logger.info(`Added ${this.rolePermissionResource} with ID ${newRecord.action} to role ${recordToUpdate.id}`);
        return filteredData;
      } else {
        throw new RecordNotFoundException(id);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.rolePermissionResource);
    }
  }

  public removePermission = async (user: User, id: string, permissionId: string):
            Promise<Role | RecordNotFoundException | UserNotAuthorizedException> => {
    const started: number = Date.now();
    const roleRepository: Repository<Role> = getConnection().getRepository(Role);

    const isOwnerOrMember: boolean = false;
    const action: string = ActivityType.DELETE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.rolePermissionResource);

    if (permission.granted) {
      const recordToUpdate = await roleRepository.findOne(id, { relations: ["permissions"] });

      if (recordToUpdate) {
        // check if relation already exists
        let removedItem: Permission;
        const updatedPermissions: Permission[] = [];
        for (const relation of recordToUpdate.permissions) {
          if (String(relation.id) === String(permissionId)) {
            removedItem = relation;
          } else {
            updatedPermissions.push(relation);
          }
        }

        // if it doesn't exist, add it to record and save update to database
        // TODO: revisit this logic and perhaps use QueryBuilder
        if (removedItem) {
          recordToUpdate.permissions = updatedPermissions;
          await roleRepository.save(recordToUpdate);
        }

        const filteredData: Role = permission.filter(recordToUpdate);
        await roleRepository.save(recordToUpdate);

        // log event to central handler
        const ended: number = Date.now();
        event.emit(ActivityType.REMOVE, {
          actor: {id: user.id, type: ActorType.Person},
          object: {id: permissionId, type: "permission"},
          resource: this.rolePermissionResource,
          target: {id, type: this.resource},
          timestamp: ended,
          took: ended - started,
          type: ActivityType.REMOVE,
        });

        logger.info(`Removed ${this.rolePermissionResource} with ID ${permissionId} from user ${id}`);
        return filteredData;
      } else {
        throw new RecordNotFoundException(id);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.rolePermissionResource);
    }
  }

}

export default RoleDao;
