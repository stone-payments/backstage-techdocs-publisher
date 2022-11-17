const fs = require('fs');
const process = require('process');
const path = require('path');
const yaml = require('js-yaml');
const dir = require('node-dir');

/**
 * @typedef { Object } Entity
 * @property { String } name - Backstage entity name
 * @property { String } namespace - Backstage entity namespace
 * @property { String } kind - Backstage entity kind property
 * @property { String } techdocsRef - pathdir reference to locate mkdocs file
 * @property { String } path - Backstage entity pathdir location
 */

/**
 * Deal with Backstage Techdocs steps, giving assistance
 * to generate and publish entities
 */
class Techdocs {
  /**
   * This constructor focus to be compliance with Techdocs-cli
   * flags and arguments
   * @param { NodeModule } core
   */
  constructor(core) {
    this.core = core;
    this.cloudStorage = core.getInput('cloud-storage');
    this.storageName = core.getInput('storage-name');
    this.options = {
      googleGcs: {
        gcsBucketRootPath: core.getInput('gcs-bucket-root-path'),
      },

      azureBlobStorage: {
        azureAccountName: core.getInput('azure-account-name'),
        azureAccountKey: core.getInput('azure-account-key'),
      },

      awsS3: {
        awsRoleArn: core.getInput('aws-role-arn'),
        awsEndpoint: core.getInput('aws-endpoint'),
        awsS3sse: core.getInput('awsS3-sse'),
        awsS3ForcePathStyle: core.getInput('awsS3-force-path-style'),
      },

      openStackSwift: {
        osCredentialId: core.getInput('os-credential-id'),
        osSecret: core.getInput('os-secret'),
        osAuthUrl: core.getInput('os-auth-url'),
        osSwiftUrl: core.getInput('os-swift-url'),
      },
    };
  }

  /**
   * Validate if cloud storage input existance and check that auxiliary
   * fields has filled as well
   *
   * @typedef { Object } Callback
   * @property { Boolean } err - Verifies if occurs error in method execution
   * @property { String } msg - The error message
   *
   * @return { Callback }
   * The callback of execution method.
   */
  validateCloudStorage() {
    const allowedTypes = [
      'awsS3',
      'googleGcs',
      'azureBlobStorage',
      'openStackSwift',
    ];

    if (!(allowedTypes.includes(this.cloudStorage))) {
      return {
        err: true,
        msg: 'cloud storage not supported. Supported cloud storages:' +
        ' (awsS3|googleGcs|azureBlobStorage|openStackSwift)',
      };
    }

    if (this.cloudStorage == 'azureBlobStorage') {
      if (this.options.azureBlobStorage.azureAccountName.length == 0) {
        return {
          err: true,
          msg: 'cloud storage azureBlobStorage require azure-account-name',
        };
      }
    }

    if (this.cloudStorage == 'openStackSwift') {
      const openStackSwift = this.options.openStackSwift;

      for (const key in openStackSwift) {
        if (openStackSwift[key].length == 0) {
          return {
            err: true,
            msg: 'missing fields to call cloud storage openStackSwift',
          };
        }
      }
    }

    return {err: false, msg: 'ok'};
  }

  /**
   * Generates docs to be publish
   *
   * @param { Entity } entity
   * @return { String }
   * Path directory that docs was generated
   */
  async generate(entity) {
    const techdocsGen =
    require('@techdocs/cli/dist/cjs/generate-103520bb.cjs.js');

    const opts = {
      verbose: false,
      sourceDir: '.',
      outputDir: './site/',
      omitTechdocsCoreMkdocsPlugin: false,
      dockerImage: 'spotify/techdocs:v1.1.0',
      legacyCopyReadmeMdToIndexMd: false,
    };

    if (entity.techdocsRef.split(':')[0] == 'url') {
      opts.techdocsRef = entity.techdocsRef;
    } else if (entity.techdocsRef.split(':')[0] == 'dir') {
      const onlyTechdocsPath = entity.techdocsRef.split(':').slice(1).join('');
      const docPath = path.join(entity.path, onlyTechdocsPath);
      opts.sourceDir = docPath;
    } else {
      throw new Error('unsupported techdocs reference annotation type');
    }

    await techdocsGen.default(opts);
    return opts.outputDir;
  }

  /**
   * publish entity to desired cloud storage
   *
   * @param { Entity } entity
   *
   * @param { String } docsDir
   */
  async publish(entity, docsDir) {
    const techdocsPublish =
    require('@techdocs/cli/dist/cjs/publish-af5607e2.cjs.js');

    const opts = {
      verbose: false,
      storageName: this.storageName,
      publisherType: this.cloudStorage,
      entity: `${entity.namespace}/${entity.kind}/${entity.name}`,
      directory: docsDir,
      legacyUseCaseSensitiveTripletPaths: false,
    };

    const optionsAvailable = this.options[this.cloudStorage];
    for (const key in optionsAvailable) {
      if (optionsAvailable[key].length > 0) {
        opts[key] = optionsAvailable[key];
      }
    }

    await techdocsPublish.default(opts);
  }
}


/**
 * Manipulates and extract entities with different ways
 */
class Entities extends Techdocs {
  /**
   * This constructor builds necessary variables
   * @param { NodeModule } core
   */
  constructor(core) {
    super(core);
    this.githubWorkspace = process.env.GITHUB_WORKSPACE;
  }


  /**
   * Generates docs to be publish
   *
   * @param { Entity } entity
   *
   * @return {Boolean}
   * Returns if entity is valid
   */
  validateEntity(entity) {
    const techdocs = entity.metadata?.annotations['backstage.io/techdocs-ref'];
    const name = entity.metadata?.name;
    const kind = entity.kind;

    const validateFields = [techdocs, name, kind];
    for (const field in validateFields) {
      if (typeof validateFields[field] === 'undefined') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get entities child of an entity kind Location
   *
   * @param { String } fileData
   * Entity data from file
   *
   * @param { String } filePath
   * File path that entity is located
   *
   * @return { Array<String> }
   * A list of entity childs
   */
  insertEntitiesIfKindLocation(fileData, filePath) {
    const appendEntityList = [];
    if (fileData.kind == 'Location') {
      const fileDir = path.dirname(filePath);

      if (typeof fileData.spec?.targets !== 'undefined') {
        for (let i = 0; i < fileData.spec.targets.length; i++) {
          appendEntityList.push(path.join(fileDir, fileData.spec.targets[i]));
        }
      }

      if (typeof fileData.spec?.target !== 'undefined') {
        appendEntityList.push(path.join(fileDir, fileData.spec.target));
      }
    }

    return appendEntityList;
  }

  /**
   * Extract unit Backstage entity data
   *
   * @param { String } filepath
   * The file path that entity is location
   *
   * @return { Object }
   * Returns array of entity object if no errors occurs, otherwise
   * an error object response will be returned.
   */
  getInfo(filepath) {
    const entityList = [];
    const filePaths = [filepath];
    if (!(['.yml', '.yaml'].includes(path.extname(filepath)))) {
      return {error: true, msg: `${filepath}: file isn't a yaml type`};
    }

    for (let i = 0; i < filePaths.length; i++) {
      const entityPath = filePaths[i];
      const entities = yaml.loadAll(fs.readFileSync(entityPath, 'utf-8'));

      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const namespace =
        (typeof entity.metadata?.namespace === 'undefined') ?
        'default' : entity.metadata.namespace;

        if (!this.validateEntity(entity)) {
          return {
            error: true,
            msg: `${entityPath}: necessary fields is missing`,
          };
        }

        entityList.push({
          name: entity.metadata.name,
          namespace: namespace,
          kind: entity.kind,
          techdocsRef: entity.metadata.annotations['backstage.io/techdocs-ref'],
          path: path.dirname(entityPath),
        });

        const locatedEntities =
        this.insertEntitiesIfKindLocation(entity, entityPath);
        filePaths.push(...locatedEntities);
      }
    }

    return entityList;
  }

  /**
   * Extract Backstage entities list from catalog file
   *
   * @param { String } catalogPath
   * The file path that catalog is location
   *
   * @return { Object }
   * Returns entities list if no errors occurs, otherwise
   * an object response will be returned.
   */
  getEntitiesByFile(catalogPath) {
    const entityList = [catalogPath];

    if (!(['.yml', '.yaml'].includes(path.extname(catalogPath)))) {
      return {
        error: true,
        msg: `${catalogPath} file isn't a valid catalog file`,
      };
    }

    const catalogData = yaml.load(fs.readFileSync(catalogPath, 'utf-8'));
    if (!this.validateEntity(catalogData)) {
      return {
        error: true,
        msg: `error to get ${catalogPath} entity: bad catalog format`,
      };
    }

    const locatedEntities =
    this.insertEntitiesIfKindLocation(catalogData, catalogPath);
    entityList.push(...locatedEntities);

    return entityList;
  }

  /**
   * Treat and publish entities
   *
   * @param { Array } entities
   * An array of entities file path
   *
   * @param { Boolean } isErr
   * Choice if want to treat error as failure
   */
  async publishEntities(entities, isErr) {
    for (let i = 0; i < entities.length; i++) {
      const entityList = this.getInfo(entities[i]);
      if (entityList.error) {
        if (isErr) {
          throw new Error(`error in ${entityList.msg}`);
        } else {
          console.log(`Ignoring ${entityList.msg}`);
          continue;
        }
      }

      for (let i = 0; i < entityList.length; i++) {
        const docsPath = await this.generate(entityList[i]);
        await this.publish(entityList[i], docsPath);
      }
    }
  }

  /**
   * Extract entities by walking desired dir and publish them all
   */
  async publishLookingPath() {
    const root =
    path.join(this.githubWorkspace, this.core.getInput('publish-looking-path'));

    await dir.files(root, async (err, files) => {
      if (err) throw err;
        await this.publishEntities(files, false);
    });
  }

  /**
   * Extract entities by catalog file and publish them all
   */
  async publishLookingFile() {
    const catalog =
    path.join(this.githubWorkspace, this.core.getInput('publish-looking-file'));
    const entities = this.getEntitiesByFile(catalog);

    if (entities.error) {
      throw new Error(entities.msg);
    }

    await this.publishEntities(entities, true);
  }
}

module.exports = Entities;
