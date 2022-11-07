import core from '@actions/core'
import github from '@actions/github'
import process from 'node:process'
import path from 'node:path'
import fs from 'fs'
import yaml from 'js-yaml'
import exec from 'child_process'
import dir from 'node-dir'

class Techdocs {
  constructor() {
    this.cloudStorage = core.getInput('cloud-storage');
    this.storageName  = core.getInput('storage-name');
    this.options = {
      googleGcs: {
        gcsBucketRootPath: core.getInput('gcs-bucket-root-path')
      },

      azureBlobStorage: {
        azureAccountName: core.getInput('azure-account-name'),
        azureAccountKey: core.getInput('azure-account-key'),
      },

      awsS3: {
        awsRoleArn: core.getInput('aws-role-arn'),
        awsEndpoint: core.getInput('aws-endpoint'),
        awsS3sse: core.getInput('awsS3-sse'),
        awsS3ForcePathStyle: core.getInput('awsS3-force-path-style')
      },

      openStackSwift: {
        osCredentialId: core.getInput('os-credential-id'),
        osSecret: core.getInput('os-secret'),
        osAuthUrl: core.getInput('os-auth-url'),
        osSwiftUrl: core.getInput('os-swift-url'),
      }
    }
  }

  validateCloudStorage() {
    const allowedTypes = ['awsS3', 'googleGcs', 'azureBlobStorage', 'openStackSwift'];

    if (!(this.cloudStorage in allowedTypes)) {
      return {err: true, msg: "cloud storage not supported. Supported cloud storages: (awsS3|googleGcs|azureBlobStorage|openStackSwift)"}
    }

    if (this.cloudStorage == 'azureBlobStorage') {
      if (this.options.azureBlobStorage.azureAccountName.length() == 0) {
        return {err: true, msg: "cloud storage azureBlobStorage require field azure-account-name"}
      } 
    }

    if (this.cloudStorage == 'openStackSwift') {
      const openStackSwift = this.options.openStackSwift;

      for (const key in openStackSwift) {
        if (openStackSwift[key].length() == 0) {
          return {err: true, msg: "missing fields to call cloud storage openStackSwift"}
        }
      }
    }

    return {err: false, msg: "ok"}
  }

  generate(entity) {
    let makeGen = {
      cmd: 'techdocs-cli generate', 
      source: '',  
    };

    if (entity.techdocsRef.split(':')[0] == 'url') {
      makeGen.source = `--techdocs-ref ${entity.techdocsRef}`
    } else if (entity.techdocsRef.split(':')[0] == 'dir') {
      makeGen.source = `--source-dir ${entity.techdocsRef}`
    } else {
      throw new Error('unsupported techdocs reference annotation type')
    }

    exec.execSync(`${makeGen.cmd} ${makeGen.source} --no-docker`, (error, _, _) => {
      throw error
    });
  }

  publish(entity) {
    let makePublish = {
      cmd: 'techdocs-cli publish',
      type: `--publisher-type ${this.cloudStorage}`,
      storageName: `--storage-name ${this.storageName}`,
      entity: `--entity ${entity.namespace}/${entity.kind}/${entity.name}`,
      options: '',
    }

    const optionsAvailable = this.options[this.cloudStorage]; 
    for (const key in optionsAvailable) {
      if (optionsAvailable[key].length() > 0) {
        makePublish.options += `--${key} ${optionsAvailable[key]}`;
      }
    }

    exec.execSync(`${makePublish.cmd} ${makePublish.type} ${makePublish.storageName} ${makePublish.entity} ${makePublish.options}`, (error, _, _) => {
      throw error
    });
  }
}

class Entities extends Techdocs {
  constructor() {
    super();
    this.githubWorkspace  = process.env.GITHUB_WORKSPACE
  }

  getInfo(filepath) {
    if (!(path.extname(filepath) in ['yml', 'yaml'])) {
      console.log(`Ignoring ${filepath}: file isn't a yaml type`);
      return
    }

    const entity    = yaml.load(fs.readFileSync(filepath, 'utf-8'));
    const techdocs  = entity.metadata.annotations['backstage.io/techdocs-ref'];
    const name      = entity.metadata.name;
    const namespace = entity.metadata.namespace;
    const kind      = entity.kind;

    const validateFields = [techdocs, name, namespace, kind];
    for (const fields in validateFields) {
      if (typeof fields === 'undefined') {
        console.log(`Ignoring ${filepath}: necessary fields is missing.`);
        return
      }
    }

    return {name: name, namespace: namespace, kind: kind, techdocsRef: techdocs};
  }

  publishLookingPath() {
    const root = path.join(this.githubWorkspace, core.getInput('path'));

    dir.files(root, (err, files) => {
      if (err) throw err
      files.forEach((filepath) => {
        let entity = this.getInfo(filepath);
        this.generate(entity);
        this.publish(entity);
      });
    });
  }

  publishLookingFile


}

try {
  const storage = core.getInput('cloud-storage');
  const azureAccountName = core.getInput('azure-account-name');

  const validate = validateStorage(storage, azureAccountName);
  if (validate.err) {
    throw new Error(validate.msg);
  }


} catch(error) {
  core.setFailed(error.message)
}