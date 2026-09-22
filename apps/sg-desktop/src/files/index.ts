import { Module } from "@stargeist/application";
import { filesLayer } from "@stargeist/storage";
import { Files } from "@stargeist/domain";

export const FilesModule = Module.define({
  exports: Files,
  layer: filesLayer,
});
