$(function(){
  var config = {
    content: [
      {
        type: 'row',
        content:[
          {
            type: 'stack',
            width: 60,
            content:[
              {
                type: 'component',
                componentName: 'layout',
                title:'Guides',
                componentState: { id: 'guides', type: 'ejs' }
              },
              {
                type: 'component',
                componentName: 'layout',
                title:'Component 2',
                componentState: { id: 'expiration' }
              }
            ]
          },
          {
            type: 'column',
            content:[
              {
                type: 'stack',
                width: 60,
                content:[
                  {
                    type: 'component',
                    componentName: 'layout',
                    title:'Etheropt',
                    componentState: { id: 'introduction', type: 'ejs' }
                  }
                ]
              },
              {
                type: 'component',
                componentName: 'layout',
                title:'Chart',
                componentState: { id: 'chart', type: 'ejs' }
              }
            ]
          }
        ]
      }
    ]
  };

  var myLayout = new GoldenLayout( config, $('#layout-container') );
  myLayout.registerComponent( 'layout', function( container, state ){
    if (state.type=='ejs') {
      var html = new EJS({url: state.id+'.ejs'}).render({});
      container.getElement().html( html );
    }
  });
  myLayout.init();
});
