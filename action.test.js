const Entities = require('./action');
const fs = require('fs');
const yaml = require('js-yaml');

test('Insert unsupported cloud storage', () => {
  const core = {
    getInput: jest.fn().mockReturnValue(''),
  };

  const techdocs = new Entities(core);
  expect(techdocs.validateCloudStorage()).
      toEqual({
        err: true,
        msg: 'cloud storage not supported. Supported cloud storages:' +
        ' (awsS3|googleGcs|azureBlobStorage|openStackSwift)',
      });
});

test('Insert azureBlobStorage storage type but ' +
'azureAccountName field is missing', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValueOnce('azureBlobStorage').
        mockReturnValue(''),
  };

  const techdocs = new Entities(core);
  expect(techdocs.validateCloudStorage()).
      toEqual({
        err: true,
        msg: 'cloud storage azureBlobStorage require ' +
        'azure-account-name',
      });
});

test('Insert openStackSwift storage type but ' +
'some required field is missing', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValueOnce('openStackSwift').
        mockReturnValue(''),
  };

  const techdocs = new Entities(core);
  expect(techdocs.validateCloudStorage()).
      toEqual({
        err: true,
        msg: 'missing fields to call cloud storage openStackSwift',
      });
});

test('Insert openStackSwift storage type ' +
'with required fields', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue('openStackSwift'),
  };

  const techdocs = new Entities(core);
  expect(techdocs.validateCloudStorage()).
      toEqual({
        err: false,
        msg: 'ok',
      });
});

test('Insert azureBlobStorage storage ' +
'type with required fields', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue('azureBlobStorage'),
  };

  const techdocs = new Entities(core);
  expect(techdocs.validateCloudStorage()).
      toEqual({
        err: false,
        msg: 'ok',
      });
});

test(`Some entity field is missing`, () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const fields = {};
  expect(entities.validateEntity(fields)).
      toBe(false);
});

test('entity fields is setted and ' +
'everything should run fine', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const fields = {
    kind: 'Component',
    metadata: {
      name: 'teste',
      namespace: 'default',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
  };

  expect(entities.validateEntity(fields)).
      toBe(true);
});

test('try get entity info but file isn\'t a yaml',
    () => {
      const core = {
        getInput: jest.fn().
            mockReturnValue(''),
      };

      const entities = new Entities(core);
      const filepath = 'teste/entity.notyaml';

      expect(entities.getInfo(filepath)).
          toEqual({
            error: true,
            msg: `${filepath}: file isn't a yaml type`,
          });
    });

test('try get entity info but entity ' +
'validator return false', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const filepath = './entity.yaml';


  fs.appendFileSync(filepath, 'test', () => {});
  expect(entities.getInfo(filepath)).
      toEqual({
        error: true,
        msg: `${filepath}: necessary fields is missing`,
      });
  fs.unlinkSync(filepath, () => {});
});

test('get entity info with success', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const filepath = './entity2.yaml';

  const content = {
    kind: 'test',
    metadata: {
      name: 'test',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
  };

  fs.appendFileSync(filepath, yaml.dump(content), () => {});

  expect(entities.getInfo(filepath)).
      toEqual([{
        name: 'test',
        namespace: 'default',
        kind: 'test',
        techdocsRef: 'dir:.',
        path: '.',
      }]);

  fs.unlinkSync(filepath, () => {});
});

test('get a catalog that is not a yaml ' +
'and should return error', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const catalogPath = './catalog.notyaml';

  expect(entities.getEntitiesByFile(catalogPath)).
      toEqual({
        error: true,
        msg: `${catalogPath} file isn't a valid catalog file`,
      });
});

test('try get catalog info but entity ' +
'validator return false', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const catalogPath = './catalog.yaml';

  fs.appendFileSync(catalogPath, 'test', () => {});

  expect(entities.getEntitiesByFile(catalogPath)).
      toEqual({
        error: true,
        msg: `error to get ${catalogPath} entity: bad catalog format`,
      });

  fs.unlinkSync(catalogPath, () => {});
});

test('get catalog info with type location ' +
'get targets entity', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const catalogPath = './catalog2.yaml';

  const content = {
    kind: 'Location',
    metadata: {
      name: 'test',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
    spec: {
      targets: ['test/entity.yml', 'test/entity2.yml'],
    },
  };

  fs.appendFileSync(catalogPath, yaml.dump(content), () => {});
  expect(entities.getEntitiesByFile(catalogPath)).
      toEqual([
        './catalog2.yaml',
        'test/entity.yml',
        'test/entity2.yml',
      ]);
  fs.unlinkSync(catalogPath, () => {});
});

test('get catalog info with type location ' +
'get only target entity', () => {
  const core = {
    getInput: jest.fn().
        mockReturnValue(''),
  };

  const entities = new Entities(core);
  const catalogPath = './catalog3.yaml';

  const content = {
    kind: 'Location',
    metadata: {
      name: 'test',
      annotations: {
        'backstage.io/techdocs-ref': 'dir:.',
      },
    },
    spec: {
      target: 'test/entity.yml',
    },
  };

  fs.appendFileSync(catalogPath, yaml.dump(content), () => {});
  expect(entities.getEntitiesByFile(catalogPath)).
      toEqual([
        './catalog3.yaml',
        'test/entity.yml',
      ]);
  fs.unlinkSync(catalogPath, () => {});
});
