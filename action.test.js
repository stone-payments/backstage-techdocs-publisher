import { Techdocs } from './action';
import { when } from 'jest-when';

test('Insert unsupported cloud storage', () => {
  const core = {
    getInput: jest.fn().mockReturnValue('')
  };

  const techdocs = new Techdocs(core);
  expect(techdocs.validateCloudStorage()).toEqual({err: true, msg: "cloud storage not supported. Supported cloud storages: (awsS3|googleGcs|azureBlobStorage|openStackSwift)"});
})

test('Insert azureBlobStorage storage type but azureAccountName field is missing', () => {
  const core = {
    getInput: jest.fn().
    mockReturnValueOnce('azureBlobStorage').
    mockReturnValue('')
  };

  const techdocs = new Techdocs(core);
  expect(techdocs.validateCloudStorage()).toEqual({err: true, msg: "cloud storage azureBlobStorage require field azure-account-name"});
})

test('Insert openStackSwift storage type but some required field is missing', () => {
  const core = {
    getInput: jest.fn().
    mockReturnValueOnce('openStackSwift').
    mockReturnValue('')
  };
  
  const techdocs = new Techdocs(core);
  expect(techdocs.validateCloudStorage()).toEqual({err: true, msg: "missing fields to call cloud storage openStackSwift"});
})

test('Insert openStackSwift storage type with required fields', () => {
  const core = {
    getInput: jest.fn().
    mockReturnValue('openStackSwift')
  };
  
  const techdocs = new Techdocs(core);
  expect(techdocs.validateCloudStorage()).toEqual({err: false, msg: "ok"});
})

test('Insert azureBlobStorage storage type with required fields', () => {
  const core = {
    getInput: jest.fn().
    mockReturnValue('azureBlobStorage')
  };

  const techdocs = new Techdocs(core);
  expect(techdocs.validateCloudStorage()).toEqual({err: false, msg: "ok"});
})

