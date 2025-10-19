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

function GenerateDefinitionCode(uiTree){
    console.log(getAllkeys(uiTree)[0])
    const ReturnValue = getAllkeys(uiTree)
    const Allkeys = Object.keys(ReturnValue[0])
    const deepth = ReturnValue[0]

    let html_code = '<div id="UiGroup" role="group" aria-label="actions">\n'
    let js_def_code = ''
    let js_code = 'function UIevent (uiID, toggle){\n'
    for(let i=0; i < Allkeys.length; i++){
        
        html_code += "  <button id = '"+Allkeys[i]+"' style = 'top: "+((30*i)+10)+"px; left: "+(deepth[Allkeys[i]].length-1)*10+"px;' > </button>\n"
        
        if (i===0){
            js_code += "  if ( uiID === '"+Allkeys[i]+"' ){ if ( toggle === 'active' ){\n  console.log( '"+Allkeys[i]+" _active' )\n  } else {\n  console.log( '"+Allkeys[i]+" _inactive' )\n  }}"
        }else{
            js_code += " else if ( uiID === '"+Allkeys[i]+"' ){ if ( toggle === 'active' ){\n  console.log( '"+Allkeys[i]+" _active' )\n  } else {\n  console.log( '"+Allkeys[i]+" _inactive' )\n  }}"        
        }
    }
    html_code += '</div>'
    js_code += '\n}'
    return [html_code, js_code]
}

function connectionUI(uiTree){
    const Allkeys = getAllkeys(uiTree)
    const UIs = {}
    for(let i=0; i < Allkeys.length; i++){
        UIs.Allkeys[i] = document.getElementById(Allkeys[i]);
    }
    return UIs.Allkeys
}



const update = {'new':'', 'move':{'x_z':'', 'y':''}}
// update = 'id_update'
const uiTree = {
    'see':'',

    'edit': {
        'rail':update,
        'poll':update,

        'creat':{
            'sphere':'',
            'cube':'',
            'pick':'',
            'move':{'x_z':'', 'y':''}
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
//     }} else if ( uiID === 'poll' ){ if ( toggle === 'active' ){
//     console.log( 'poll _active' )
//     } else {
//     console.log( 'poll _inactive' )
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

console.log(GenerateDefinitionCode(uiTree)[0])

const ReturnValue = getAllkeys(uiTree);
const Allkeys = ReturnValue[0]
const UisToggle = {...Allkeys};
Object.keys(UisToggle).forEach(key => {
    UisToggle[key] = 'inactive';
  });
UisToggle[Object.keys(UisToggle)[0]]='active'
const rename_uiTree = ReturnValue[2]

console.log(uiTree)
console.log(rename_uiTree)
// getValueByIndex(rename_uiTree,0,[1,1])

const UiGroup = document.getElementById('UiGroup');

UiGroup.querySelectorAll('button').forEach(b => {
    if (b.id === 'see' | b.id === 'edit') {
      b.hidden = false; // 押されたボタンは表示
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
    if (b.id === 'see' | b.id === 'edit') {
      b.hidden = false; // 押されたボタンは表示
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
      if (b.id === 'see' | b.id === 'edit') {
        b.hidden = false; // 押されたボタンは表示
      }
    })
  });
  