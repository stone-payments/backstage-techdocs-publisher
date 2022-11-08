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
    const namespace = entity.metadata?.namespace;
    const kind      = entity.kind;

    const validateFields = [techdocs, name, namespace, kind];
    for (const fields in validateFields) {
      if (typeof fields === 'undefined') {
        return false
      }
    }

    return true
  }

  getInfo(filepath) {
    if (!(path.extname(filepath) in ['yml', 'yaml'])) {
      console.log(`Ignoring ${filepath}: file isn't a yaml type`);
      return
    }

    const entity = yaml.load(fs.readFileSync(filepath, 'utf-8'));
    if (!this.validateEntity(entity)) {
      return {error: true}
    }

    return {
      name: entity.metadata.name,
      namespace: entity.metadata.namespace,
      kind: entity.kind, 
      techdocsRef: entity.metadata.annotations['backstage.io/techdocs-ref'],
      path: path.dirname(filepath)
    };
  }

  getEntitiesByFile(catalogPath) {
    let entityList = [catalogPath];

    if (!(path.extname(catalogPath) in ['yml', 'yaml'])) {
      throw new Error(`${catalogPath} file isn't a valid catalog file`);
    }

    const catalogData = yaml.load(fs.readFileSync(catalogPath, 'utf-8'));
    if (!this.validateEntity(entity)) {
      return false
    }

    if (catalogData.kind == 'Location') {
      const catalogDir = path.dirname(catalogPath);
      catalogData.spec?.targets.forEach(target => {
        entityList.push(path.join(catalogDir, target));
      });
    }

    return entityList
  }

  publishEntities(entities, isErr) {
    for (let i = 0; i < entities.length; i++) {
      let entity = this.getInfo(entities[i]);
      if (entity.error) {
        if (isErr) {
          throw new Error(`error in ${entities[i]}: necessary fields is missing`);
        } else {
          console.log(`Ignoring ${files[i]}: necessary fields is missing`);
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