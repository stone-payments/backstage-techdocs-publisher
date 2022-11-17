const core = require('@actions/core');
const Entities = require('./action');

try {
  const entities = new Entities(core);
  const validate = entities.validateCloudStorage();
  if (validate.err) {
    throw new Error(validate.msg);
  }

  if (core.getInput('publish-looking-path').length > 0) {
    await entities.publishLookingPath();
  } else if (core.getInput('publish-looking-file').length > 0) {
    await entities.publishLookingFile();
  } else {
    throw new Error('error no publication type was specified');
  }
} catch (error) {
  core.setFailed(error.message);
}
