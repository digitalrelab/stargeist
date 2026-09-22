import { Module } from "@stargeist/application";
import { filesLayer } from "@stargeist/database/files";
import { Files } from "@stargeist/domain";

export const FilesModule = Module.define({ exports: Files, layer: filesLayer });
