export function createArticleAccess({isGlobalEditor,canDraftAll=()=>false}) {
  return actor=>{
    if(typeof actor!=='string'||!/^[a-f0-9]{64}$/.test(actor))throw Object.assign(new Error('Content access denied.'),{status:403});
    return {global:!!isGlobalEditor(actor),workspaceAll:!!canDraftAll(actor),articleIds:[]};
  };
}
