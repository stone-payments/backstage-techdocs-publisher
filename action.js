import process from 'node:process'
import path from 'node:path'
import fs from 'fs'
import yaml from 'js-yaml'
import exec from 'child_process'
import dir from 'node-dir'

export class Techdocs {
  constructor(core) {
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

    if (!(allowedTypes.includes(this.cloudStorage))) {
      return {err: true, msg: "cloud storage not supported. Supported cloud storages: (awsS3|googleGcs|azureBlobStorage|openStackSwift)"}
    }

    if (this.cloudStorage == 'azureBlobStorage') {
      if (this.options.azureBlobStorage.azureAccountName.length == 0) {
        return {err: true, msg: "cloud storage azureBlobStorage require field azure-account-name"}
      } 
    }

    if (this.cloudStorage == 'openStackSwift') {
      const openStackSwift = this.options.openStackSwift;

      for (const key in openStackSwift) {
        if (openStackSwift[key].length == 0) {
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
      makeGen.source = `--techdocs-ref ${entity.techdocsRef}`;
    } else if (entity.techdocsRef.split(':')[0] == 'dir') {
      const onlyTechdocsPath = entity.techdocsRef.split(':').slice(1).join('');
      const docPath  = path.join(entity.path, onlyTechdocsPath);
      makeGen.source = `--source-dir ${docPath}`;
    } else {
      throw new Error('unsupported techdocs reference annotation type');
    }

    exec.execSync(`${makeGen.cmd} ${makeGen.source} --no-docker`, (error, undefined, _) => {
      throw error;
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

    exec.execSync(`${makePublish.cmd} ${makePublish.type} ${makePublish.storageName} ${makePublish.entity} ${makePublish.options}`, (error, undefined, _) => {
      throw error;
    });
  }
}

export class Entities extends Techdocs {
  constructor(core) {
    super(core);
    this.githubWorkspace  = process.env.GITHUB_WORKSPACE;
  }

  validateEntity(entity) {
    const techdocs  = entity.metadata?.annotations['backstage.io/techdocs-ref'];
    const name      = entity.metadata?.name;
    const kind      = entity.kind;

    const validateFields = [techdocs, name, kind];
    for (const field in validateFields) {
      if (typeof validateFields[field] === 'undefined') {
        return false
      }
    }

    return true
  }

  getInfo(filepath) {
    if (!(['.yml', '.yaml'].includes(path.extname(filepath)))) {
      return {error: true, msg: `${filepath}: file isn't a yaml type`}
    }

    const entity = yaml.load(fs.readFileSync(filepath, 'utf-8'));
    console.log(entity);
    const namespace = (typeof entity.metadata?.namespace === 'undefined') ? 'default' : entity.metadata.namespace;
    if (!this.validateEntity(entity)) {
      return {error: true, msg: `${filepath}: necessary fields is missing`}
    }

    return {
      name: entity.metadata.name,
      namespace: namespace,
      kind: entity.kind, 
      techdocsRef: entity.metadata.annotations['backstage.io/techdocs-ref'],
      path: path.dirname(filepath)
    };
  }

  getEntitiesByFile(catalogPath) {
    let entityList = [catalogPath];

    if (!(['.yml', '.yaml'].includes(path.extname(catalogPath)))) {
      throw new Error(`${catalogPath} file isn't a valid catalog file`);
    }

    const catalogData = yaml.load(fs.readFileSync(catalogPath, 'utf-8'));
    if (!this.validateEntity(catalogData)) {
      return false
    }

    if (catalogData.kind == 'Location') {
      const catalogDir = path.dirname(catalogPath);

      if (typeof catalogData.spec?.targets !== 'undefined') {
        for (let i = 0; i < catalogData.spec.targets.length; i++) {
          entityList.push(path.join(catalogDir, catalogData.spec.targets[i]));
        }
      }

      if (typeof catalogData.spec?.target !== 'undefined') {
        entityList.push(path.join(catalogDir, catalogData.spec.target));
      }
    }

    return entityList
  }

  publishEntities(entities, isErr) {
    for (let i = 0; i < entities.length; i++) {
      let entity = this.getInfo(entities[i]);
      if (entity.error) {
        if (isErr) {
          throw new Error(`error in ${entity.msg}`);
        } else {
          console.log(`Ignoring ${entity.msg}`);
          continue;
        }
      }

      this.generate(entity);
      this.publish(entity);
    }
  }

  publishLookingPath() {
    const root = path.join(this.githubWorkspace, core.getInput('publish-looking-path'));

    dir.files(root, (err, files) => {
      if (err) throw err
      this.publishEntities(files, false);
    });
  }

  publishLookingFile() {
    const catalog = path.join(this.githubWorkspace, core.getInput('publish-looking-file'));
    const entities = this.getEntitiesByFile(catalog);

    if (!entities) {
      throw new Error('error to get entities: bad catalog format');
    }

    this.publishEntities(entities, true);
  }
}