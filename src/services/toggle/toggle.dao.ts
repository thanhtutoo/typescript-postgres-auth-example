import { getRepository, Repository } from "typeorm";
import event from "../../config/event";
import logger from "../../config/logger";
import Dao from "../../interfaces/dao.interface";
import RecordNotFoundException from "../../exceptions/RecordNotFoundException";
import RecordsNotFoundException from "../../exceptions/RecordsNotFoundException";
import UserNotAuthorizedException from "../../exceptions/UserNotAuthorizedException";
import { AuthPermission, getPermission, methodActions } from "../../utils/authorization.helper";

import { User } from "../../services/user/user.entity";
import { Toggle } from "./toggle.entity";
import CreateToggleDto from "./toggle.dto";

/**
 * Handles CRUD operations on Toggle data in database
 * Factoring to this class allows other (i.e. GraphQL to reuse this code in resolvers)
 */
class ToggleDao implements Dao {
  private resource: string = "toggle"; // matches defined toggle toggle "resource"
  private toggleRepository: Repository<Toggle> = getRepository(Toggle);

  constructor() {
    // nothing
  }

  public getAll = async (user: User, params?: {[key: string]: any}):
            Promise<Toggle[] | RecordsNotFoundException | UserNotAuthorizedException> => {
    const records = await this.toggleRepository.find({ relations: ["permissions"] });

    const isOwnerOrMember: boolean = false;
    const action: string = methodActions.GET;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!records) {
        throw new RecordsNotFoundException(this.resource);
      } else {
        // log event to central handler
        event.emit("read-all", {
          action,
          actor: user,
          object: records,
          resource: this.resource,
          timestamp: Date.now(),
          verb: "read-all",
        });

        return permission.filter(records);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public getOne = async (user: User, id: string | number):
            Promise<Toggle | RecordNotFoundException | UserNotAuthorizedException> => {
    const record = await this.toggleRepository.findOne(id, { relations: ["permissions"] });

    const isOwnerOrMember: boolean = false;
    const action: string = methodActions.GET;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (!record) {
        throw new RecordNotFoundException(id);
      } else {
        // log event to central handler
        event.emit("read-one", {
          action,
          actor: user,
          object: record,
          resource: this.resource,
          timestamp: Date.now(),
          verb: "read-one",
        });

        return permission.filter(record);
      }
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public save = async (user: User, data: any):
            Promise<Toggle | RecordNotFoundException | UserNotAuthorizedException> => {
    const newRecord: CreateToggleDto = data;

    const isOwnerOrMember: boolean = false;
    const action: string = methodActions.POST;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      const filteredData: Toggle = permission.filter(newRecord);
      await this.toggleRepository.save(filteredData);

      // log event to central handler
      event.emit("save", {
        action,
        actor: user,
        object: filteredData,
        resource: this.resource,
        timestamp: Date.now(),
        verb: "save",
      });

      logger.info(`Saved ${this.resource} with ID ${filteredData.id} in the database`);
      return filteredData;
    } else {
      throw new UserNotAuthorizedException(user.id, action, this.resource);
    }
  }

  public remove = async (user: User, id: string | number):
            Promise<boolean | RecordNotFoundException | UserNotAuthorizedException> => {
    const recordToRemove = await this.toggleRepository.findOne(id);

    const isOwnerOrMember: boolean = false;
    const action: string = methodActions.DELETE;
    const permission: AuthPermission = await getPermission(user, isOwnerOrMember, action, this.resource);

    if (permission.granted) {
      if (recordToRemove) {
        await this.toggleRepository.remove(recordToRemove);

        // log event to central handler
        event.emit("remove", {
          action,
          actor: user,
          object: recordToRemove,
          resource: this.resource,
          timestamp: Date.now(),
          verb: "remove",
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

}

export default ToggleDao;