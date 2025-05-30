import { h } from "vue";
import { useStore } from '../store';
import { GameControllerOutline } from '@vicons/ionicons5'

const button = {
    name: "btn-component",
    render() {
        return h(
            "button",
            {
                id: "btn-remote",
                style: {
                    'background-color': 'red',
                    'border': 'none',
                    'color': 'white',
                    'padding': '15px 32px',
                    'text-align': 'center',
                    'text-decoration': 'none',
                    'display': 'inline-block',
                    'font-size': '16px'
                },
                onClick: () => {
                    const store = useStore();
                    store.increase();
                }
            },
            [h(GameControllerOutline), "Hello Remote Button"]
        );
    },
};

export default button;
