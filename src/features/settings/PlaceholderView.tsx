interface Props {
  title: string;
  body: string;
}

/** 待设计模块的占位。用的是原型自己的 .s-placeholder，不是新组件。 */
export default function PlaceholderView({ title, body }: Props) {
  return (
    <div className="s-view active">
      <h2>{title}</h2>
      <p className="s-desc">待设计</p>
      <div className="s-placeholder">
        <b>{title}</b>
        {body}
      </div>
    </div>
  );
}
