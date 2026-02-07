// インデックス検索コード
import { UIevent } from './main.js';

function toggleProcessing(uiIDs,next_nest){
    
    // 無効化
    UiGroup.querySelectorAll('button').forEach(b => {
        // console.log(b.id)
        const active = uiIDs.includes(b.id);
        const next = next_nest.includes(b.id);
        if (!active) {
            b.hidden = true; // 非表示
            if(UisToggle[b.id] === 'active'){
                // console.log('ruuu')
                UisToggle[b.id] = 'inactive'
                UIevent (b.id, 'inactive')
            }
        }

        if (next){
            b.hidden = false; // 表示
        }
    })

    // 有効化
    UiGroup.querySelectorAll('button').forEach(b => {
        // console.log(b.id)
        const active = uiIDs.includes(b.id);
        if (active) {
            b.hidden = false; // 表示
            if(UisToggle[b.id] === 'inactive'){
                // console.log('runn')
                UisToggle[b.id] = 'active'
                UIevent (b.id, 'active')
            }
        }
    })
}

function getValueByIndex(uiTree, UiGroup, index){

    const active_UIs = []
    const next_nest = []

    // UiGroup.querySelectorAll('button').forEach(b => {
    //     b.hidden = true; // 押されたボタンは表示
    // })
        
    let val = []
    for (let i = 0; i < index.length; i++){
        const values = Object.entries(uiTree);  // ["Apple", "Banana", "Cherry"]
        
        if (values.length-1 < index[i]){
            console.log('存在しない値です')
            return
        }
        uiTree = values[index[i]][1]
        const key = values[index[i]][0]
        active_UIs.push(key)
        
        // UiGroup.querySelectorAll('button').forEach(b => {
        //     if (b.id === key) {
        //       b.hidden = false; // 押されたボタンは表示
        //     }
        //   });
        
        const nest = Object.keys(uiTree);  // ["Apple", "Banana", "Cherry"]

        //  console.log(val.length)
        for (let i_a = 0; i_a < nest.length; i_a++){
            next_nest.push(nest[i_a])
            // UiGroup.querySelectorAll('button').forEach(b => {
            //     if (b.id === nest[i_a]) {
            //     b.hidden = false; // 押されたボタンは表示
            //     }
            // });
        }
    }

    toggleProcessing(active_UIs,next_nest)

}

function getAllkeys(uiTree, now_index=[], Allkeys={}, Duplication={}, rename_uiTree={}){
    const obj = Object.entries(uiTree)
    for (let i = 0; i <obj.length; i++){
        const key = obj[i][0]
        let rename_key = key
        if(Duplication[key] > 0){
            Duplication[key] += 1
            rename_key = key+'/'+Duplication[key]
            Allkeys[rename_key] = now_index.concat([i])
        } else {
            Duplication[key] = 1
            Allkeys[key] = now_index.concat([i])
        }
        rename_uiTree[rename_key] = ''
        const ReturnValue = getAllkeys(obj[i][1], now_index.concat([i]), Allkeys, Duplication)
        Allkeys = ReturnValue[0]
        Duplication = ReturnValue[1]
        if (Object.keys(ReturnValue[2]).length > 0){rename_uiTree[rename_key] = ReturnValue[2]}
    }
    return [Allkeys, Duplication, rename_uiTree]
}

function buildUiGroup(uiTree, uiGroup){
    const ReturnValue = getAllkeys(uiTree)
    const allKeysMap = ReturnValue[0]
    const orderedKeys = Object.keys(allKeysMap)
    const deepth = allKeysMap
    const creatPath = allKeysMap['creat'] || null
    const railPath = allKeysMap['rail'] || null
    const railRowIndex = orderedKeys.indexOf('rail')
    const creatRowIndex = orderedKeys.indexOf('creat')
    const railBaseLeft = Array.isArray(railPath) ? (railPath.length - 1) * 10 : 10
    const creatBranchOffset = 80

    if (!uiGroup) {
        return { allKeysMap, orderedKeys, renameTree: ReturnValue[2] }
    }

    uiGroup.textContent = ''
    for (let i = 0; i < orderedKeys.length; i++){
        const key = orderedKeys[i]
        const btn = document.createElement('button')
        const path = deepth[key]
        const inCreatBranch = Array.isArray(creatPath)
          && Array.isArray(path)
          && creatPath.every((v, idx) => path[idx] === v)
        btn.id = key
        const topRow = inCreatBranch && railRowIndex >= 0 && creatRowIndex >= 0
            ? railRowIndex + (i - creatRowIndex)
            : i
        btn.style.top = ((30 * topRow) + 10) + 'px'
        if (inCreatBranch) {
            btn.style.left = (railBaseLeft + creatBranchOffset + (path.length - creatPath.length) * 10) + 'px'
            btn.style.right = 'auto'
        } else {
            btn.style.left = ((path.length - 1) * 10) + 'px'
            btn.style.right = 'auto'
        }
        btn.textContent = key
        uiGroup.appendChild(btn)
    }

    return { allKeysMap, orderedKeys, renameTree: ReturnValue[2] }
}

function connectionUI(uiTree){
    const Allkeys = getAllkeys(uiTree)
    const UIs = {}
    for(let i=0; i < Allkeys.length; i++){
        UIs.Allkeys[i] = document.getElementById(Allkeys[i]);
    }
    return UIs.Allkeys
}

const uiTree = {
    'see':'',

    'edit': {
        'rail':{
            'new':'', 
            'move':{
                'x_z':'', 
                'y':''},
            'structure':{
                'new':'',
                'construction':{
                    'bridge':'',
                    'elevated':'',
                    'wall':'',
                    'floor':'',
                    'pillar':'',
                    'rib_bridge':'',
                    'tunnel_rect':'',
                }}
            
        },
        'creat':{
            'view':'',
            'add_point':{
                'y_add':''
            },
            'move_point':{
                'x_z_sf':'',
                'y_sf':''
            },
            'construction':{
                'pillar':{
                    'Round_bar':'',
                    'H_beam':'',
                },
                'rite':{
                    'tubular':'',
                }
            },
        },

        'custom':{
            'new':'',
            'move':{'x_z':'', 'y':''},
            'construct':''
        }
    }
}

// function UIevent (uiID, toggle){
//     if ( uiID === 'see' ){ if ( toggle === 'active' ){
//     console.log( 'see _active' )
//     } else {
//     console.log( 'see _inactive' )
//     }} else if ( uiID === 'edit' ){ if ( toggle === 'active' ){
//     console.log( 'edit _active' )
//     } else {
//     console.log( 'edit _inactive' )
//     }} else if ( uiID === 'rail' ){ if ( toggle === 'active' ){
//     console.log( 'rail _active' )
//     } else {
//     console.log( 'rail _inactive' )
//     }} else if ( uiID === 'new' ){ if ( toggle === 'active' ){
//     console.log( 'new _active' )
//     } else {
//     console.log( 'new _inactive' )
//     }} else if ( uiID === 'move' ){ if ( toggle === 'active' ){
//     console.log( 'move _active' )
//     } else {
//     console.log( 'move _inactive' )
//     }} else if ( uiID === 'x_z' ){ if ( toggle === 'active' ){
//     console.log( 'x_z _active' )
//     } else {
//     console.log( 'x_z _inactive' )
//     }} else if ( uiID === 'y' ){ if ( toggle === 'active' ){
//     console.log( 'y _active' )
//     } else {
//     console.log( 'y _inactive' )
//     }} else if ( uiID === 'new/2' ){ if ( toggle === 'active' ){
//     console.log( 'new/2 _active' )
//     } else {
//     console.log( 'new/2 _inactive' )
//     }} else if ( uiID === 'move/2' ){ if ( toggle === 'active' ){
//     console.log( 'move/2 _active' )
//     } else {
//     console.log( 'move/2 _inactive' )
//     }} else if ( uiID === 'x_z/2' ){ if ( toggle === 'active' ){
//     console.log( 'x_z/2 _active' )
//     } else {
//     console.log( 'x_z/2 _inactive' )
//     }} else if ( uiID === 'y/2' ){ if ( toggle === 'active' ){
//     console.log( 'y/2 _active' )
//     } else {
//     console.log( 'y/2 _inactive' )
//     }} else if ( uiID === 'creat' ){ if ( toggle === 'active' ){
//     console.log( 'creat _active' )
//     } else {
//     console.log( 'creat _inactive' )
//     }} else if ( uiID === 'sphere' ){ if ( toggle === 'active' ){
//     console.log( 'sphere _active' )
//     } else {
//     console.log( 'sphere _inactive' )
//     }} else if ( uiID === 'cube' ){ if ( toggle === 'active' ){
//     console.log( 'cube _active' )
//     } else {
//     console.log( 'cube _inactive' )
//     }} else if ( uiID === 'pick' ){ if ( toggle === 'active' ){
//     console.log( 'pick _active' )
//     } else {
//     console.log( 'pick _inactive' )
//     }} else if ( uiID === 'x_z/3' ){ if ( toggle === 'active' ){
//     console.log( 'x_z/3 _active' )
//     } else {
//     console.log( 'x_z/3 _inactive' )
//     }} else if ( uiID === 'y/3' ){ if ( toggle === 'active' ){
//     console.log( 'y/3 _active' )
//     } else {
//     console.log( 'y/3 _inactive' )
//     }}
//   }

const UiGroup = document.getElementById('UiGroup');
const buildResult = buildUiGroup(uiTree, UiGroup)
const Allkeys = buildResult.allKeysMap
const rename_uiTree = buildResult.renameTree
const UisToggle = {...Allkeys};
Object.keys(UisToggle).forEach(key => {
    UisToggle[key] = 'inactive';
  });
UisToggle[Object.keys(UisToggle)[0]]='active'

console.log(uiTree)
console.log(rename_uiTree)
// getValueByIndex(rename_uiTree,0,[1,1])

const rootKeys = Object.keys(rename_uiTree)
UiGroup.querySelectorAll('button').forEach(b => {
    if (rootKeys.includes(b.id)) {
      b.hidden = false; // ルートは表示
    } else {
      b.hidden = true;
    }
  })

UiGroup.addEventListener('click', (event) => {
  // クリックされた要素から一番近い button を探す
  const btn = event.target.closest('button');
  if (!btn || !UiGroup.contains(btn)) return; // グループ外やボタン以外は無視

  // ID を取得
  const id = btn.id; // 例: "btn-save"
  console.log('押されたボタンのID:', id, Allkeys[id]);

//   UIevent(id)

  getValueByIndex(rename_uiTree,UiGroup,Allkeys[id])
  // もし data-id を使いたければ:
  // console.log('data-id:', btn.dataset.id);
  UiGroup.querySelectorAll('button').forEach(b => {
    if (rootKeys.includes(b.id)) {
      b.hidden = false; // ルートは常時表示
    }
  })
});

UiGroup.addEventListener('touchstart', (event) => {
    // クリックされた要素から一番近い button を探す
    const btn = event.target.closest('button');
    if (!btn || !UiGroup.contains(btn)) return; // グループ外やボタン以外は無視
  
    // ID を取得
    const id = btn.id; // 例: "btn-save"
    console.log('押されたボタンのID:', id, Allkeys[id]);
  
  //   UIevent(id)
  
    getValueByIndex(rename_uiTree,UiGroup,Allkeys[id])
    // もし data-id を使いたければ:
    // console.log('data-id:', btn.dataset.id);
    UiGroup.querySelectorAll('button').forEach(b => {
      if (rootKeys.includes(b.id)) {
        b.hidden = false; // ルートは常時表示
      }
    })
  });
  
