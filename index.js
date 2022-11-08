import core from '@actions/core'
import { Entities } from './action';

try {
  const entities = Entities(core);
  const validate = entities.validateCloudStorage();
  if (validate.err) {
    throw new Error(validate.msg);
  }

  if (core.getInput('publish-looking-path').length() > 0) {
    entities.publishLookingPath();
  } else if (core.getInput('publish-looking-file').length() > 0) {
    entities.publishLookingFile();
  } else if (core.getMultilineInput('publish-entities-list').length() > 0) {
    entities.publishEntities(core.getMultilineInput('publish-entities-list'), true);
  } else {
    throw new Error('error no publication type was specified');
  }

} catch(error) {
  core.setFailed(error.message)
}