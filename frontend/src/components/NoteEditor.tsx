'use client';

import { useRef, useEffect } from 'react';
import {
  MDXEditor,
  MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  Separator,
  InsertCodeBlock,
  InsertTable,
  InsertImage,
  InsertThematicBreak,
  UndoRedo,
  DiffSourceToggleWrapper,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

interface NoteEditorProps {
  value: string;
  onChange: (markdown: string) => void;
}

// Override of MDXEditor's English UI strings (tooltip / button label / aria-label).
// Keys not in this map fall back to MDXEditor's default English.
const ZH_LABELS: Record<string, string> = {
  'toolbar.undo': '撤销',
  'toolbar.redo': '重做',
  'toolbar.bold': '加粗',
  'toolbar.removeBold': '取消加粗',
  'toolbar.italic': '斜体',
  'toolbar.removeItalic': '取消斜体',
  'toolbar.underline': '下划线',
  'toolbar.removeUnderline': '取消下划线',
  'toolbar.code': '行内代码',
  'toolbar.removeCode': '取消代码',
  'toolbar.bulletedList': '无序列表',
  'toolbar.numberedList': '有序列表',
  'toolbar.checkList': '任务列表',
  'toolbar.link': '链接',
  'toolbar.createLink': '插入链接',
  'toolbar.removeLink': '移除链接',
  'toolbar.editLink': '编辑链接',
  'toolbar.image': '图片',
  'toolbar.addImage': '插入图片',
  'toolbar.table': '表格',
  'toolbar.insertTable': '插入表格',
  'toolbar.codeBlock': '代码块',
  'toolbar.insertCodeBlock': '插入代码块',
  'toolbar.thematicBreak': '分割线',
  'toolbar.insertThematicBreak': '插入分割线',
  'toolbar.blockTypeSelect.placeholder': '选择段落类型',
  'toolbar.blockTypes.paragraph': '段落',
  'toolbar.blockTypes.quote': '引用',
  'toolbar.blockTypes.heading': '标题',
  'toolbar.headings.heading1': '一级标题',
  'toolbar.headings.heading2': '二级标题',
  'toolbar.headings.heading3': '三级标题',
  'toolbar.headings.heading4': '四级标题',
  'toolbar.headings.heading5': '五级标题',
  'toolbar.headings.heading6': '六级标题',
  'toolbar.toggleGroup': '切换',
  'toolbar.richText': '所见即所得',
  'toolbar.diffMode': '对比',
  'toolbar.source': '源码',
  'dialogControls.save': '保存',
  'dialogControls.cancel': '取消',
  'linkPreview.open': '打开',
  'linkPreview.copy': '复制',
  'linkPreview.copied': '已复制',
  'linkPreview.edit': '编辑链接',
  'linkPreview.remove': '移除链接',
  'createLink.url': '链接地址',
  'createLink.urlPlaceholder': 'https://...',
  'createLink.title': '标题',
  'createLink.titlePlaceholder': '可选',
  'createLink.saveTooltip': '保存',
  'createLink.cancelTooltip': '取消',
  'image.alt': '替代文字',
  'image.title': '标题',
  'image.src': '图片地址',
  'image.upload': '上传图片',
  'image.dialogTitle': '插入图片',
  'image.autoCompletePlaceholder': '搜索图片',
  'image.addViaUrlButton': '添加',
  'table.deleteTable': '删除表格',
  'table.columnMenu': '列菜单',
  'table.textAlignment': '对齐方式',
  'table.alignLeft': '左对齐',
  'table.alignCenter': '居中',
  'table.alignRight': '右对齐',
  'table.deleteColumn': '删除列',
  'table.insertColumnLeft': '左侧插入列',
  'table.insertColumnRight': '右侧插入列',
  'table.rowMenu': '行菜单',
  'table.deleteRow': '删除行',
  'table.insertRowAbove': '上方插入行',
  'table.insertRowBelow': '下方插入行',
  'codeBlock.language': '语言',
  'codeBlock.selectLanguage': '选择语言',
  'codeblock.delete': '删除代码块',
};

export default function NoteEditor({ value, onChange }: NoteEditorProps) {
  const ref = useRef<MDXEditorMethods>(null);

  // Sync external value into MDXEditor when it changes from outside (e.g. raw textarea).
  // Skip when the change came from MDXEditor itself (getMarkdown matches value).
  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.getMarkdown() !== value) {
      ref.current.setMarkdown(value);
    }
  }, [value]);

  return (
    <MDXEditor
      ref={ref}
      markdown={value}
      onChange={onChange}
      contentEditableClassName="mdx-content"
      className="mdx-editor-root"
      translation={(key, defaultValue, interpolations) => {
        // Heading levels share one key; differentiate by interpolations.level (1–6)
        if (key === 'toolbar.blockTypes.heading' && interpolations?.level) {
          const cn = ['一', '二', '三', '四', '五', '六'][interpolations.level - 1];
          return cn ? `${cn}级标题` : `${interpolations.level}级标题`;
        }
        return ZH_LABELS[key] ?? defaultValue;
      }}
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        markdownShortcutPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        imagePlugin(),
        tablePlugin(),
        codeBlockPlugin({ defaultCodeBlockLanguage: 'ts' }),
        codeMirrorPlugin({
          codeBlockLanguages: {
            ts: 'TypeScript',
            tsx: 'TSX',
            js: 'JavaScript',
            jsx: 'JSX',
            py: 'Python',
            sh: 'Shell',
            json: 'JSON',
            css: 'CSS',
            html: 'HTML',
            md: 'Markdown',
            sql: 'SQL',
            '': '纯文本',
          },
        }),
        diffSourcePlugin({ diffMarkdown: value, viewMode: 'rich-text' }),
        toolbarPlugin({
          toolbarContents: () => (
            <DiffSourceToggleWrapper>
              <UndoRedo />
              <Separator />
              <BoldItalicUnderlineToggles />
              <Separator />
              <BlockTypeSelect />
              <Separator />
              <ListsToggle />
              <Separator />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertCodeBlock />
              <InsertThematicBreak />
            </DiffSourceToggleWrapper>
          ),
        }),
      ]}
    />
  );
}
