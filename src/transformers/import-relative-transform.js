import {dirname, relative, resolve} from 'path';
import {ensureDotSlash, isRelativePath} from './fileHelpers';

const renameLiteral = (j, preFileDir, nextFileDir) => (path) => {
  const absolutePath = resolve(preFileDir, path.value.value);
  const nextRelativePath = ensureDotSlash(relative(nextFileDir, absolutePath));
  j(path).replaceWith(() => j.literal(nextRelativePath));
};

export default function importRelativeTransform(file, api, options) {
  const {path: filePath, source} = file;
  const {jscodeshift: j} = api;
  let {paths, printOptions = {}} = options;

  let prevFilePath;
  if (!Array.isArray(paths)) {
    prevFilePath = options.prevFilePath;
  } else {
    const found = paths.find(({nextFilePath}) => filePath === nextFilePath);
    if (found) prevFilePath = found.prevFilePath;
  }

  // noop
  if (prevFilePath == null) return null;

  const root = j(source);
  const filterNonRelativePaths = (path) => isRelativePath(path.value.value);

  const requires = root
    .find(j.VariableDeclarator, {
      id: {type: 'Identifier'},
      init: {callee: {name: 'require'}},
    })
    .find(j.Literal)
    .filter(filterNonRelativePaths);

  const imports = root
    .find(j.ImportDeclaration)
    .find(j.Literal)
    .filter(filterNonRelativePaths);

  const nodesToUpdate = [].concat(requires.paths(), imports.paths());

  const noop = nodesToUpdate.length <= 0;
  if (noop) return null;

  const prevFileDir = dirname(prevFilePath);
  const nextFileDir = dirname(filePath);
  nodesToUpdate.forEach(
    renameLiteral(j, prevFileDir, nextFileDir)
  );

  return root.toSource(printOptions);
}
